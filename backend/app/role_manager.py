import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .supabase_client import supabase


class RoleManager:
    """Role + workflow routing config loaded from Supabase, with JSON file fallback."""

    def __init__(self, config_path: str = "config/roles.json"):
        self.config_path = Path(__file__).parent.parent / config_path
        self.config: Dict[str, Any] = {}
        self._use_db = False
        self.reload()

    def reload(self) -> None:
        try:
            res = supabase.table("roles").select("*").execute()
            rows = res.data or []
            if not rows:
                self._load_file()
                return

            self.config = {
                "roles": {},
                "workflow_permissions": {},
                "department_to_state_mapping": {},
                "service_to_department_mapping": {},
            }
            for row in rows:
                rn = row["role_name"]
                perms = row.get("permissions") or []
                if isinstance(perms, str):
                    perms = json.loads(perms)
                depts = row.get("departments") or []
                if isinstance(depts, str):
                    depts = json.loads(depts)
                if not isinstance(perms, list):
                    perms = []
                if not isinstance(depts, list):
                    depts = []
                self.config["roles"][rn] = {
                    "name": row.get("display_name") or rn,
                    "description": row.get("description") or "",
                    "permissions": perms,
                    "departments": depts,
                    "can_assign_roles": bool(row.get("can_assign_roles", False)),
                    "priority": int(row.get("priority") or 0),
                }

            for key in ("workflow_permissions", "department_to_state_mapping", "service_to_department_mapping"):
                s = supabase.table("app_settings").select("*").eq("key", key).execute()
                if s.data:
                    self.config[key] = s.data[0]["value"] or {}

            self._use_db = True
        except Exception as e:
            print(f"RoleManager: database load failed ({e}), using JSON file")
            self._load_file()

    def _load_file(self) -> None:
        self._use_db = False
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
        except FileNotFoundError:
            self.config = self._get_default_config()

    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "roles": {},
            "workflow_permissions": {},
            "department_to_state_mapping": {},
            "service_to_department_mapping": {},
        }

    def get_role_config(self, role_name: str) -> Optional[Dict[str, Any]]:
        return self.config.get("roles", {}).get(role_name)

    def get_all_roles(self) -> List[Dict[str, Any]]:
        roles = []
        for role_id, role_config in self.config.get("roles", {}).items():
            roles.append(
                {
                    "role_id": role_id,
                    "name": role_config.get("name"),
                    "description": role_config.get("description"),
                    "permissions": role_config.get("permissions", []),
                    "departments": role_config.get("departments", []),
                    "priority": role_config.get("priority", 0),
                    "can_assign_roles": role_config.get("can_assign_roles", False),
                }
            )
        return sorted(roles, key=lambda x: x["priority"], reverse=True)

    def get_role_names(self) -> List[str]:
        return list(self.config.get("roles", {}).keys())

    def has_permission(self, role: str, permission: str) -> bool:
        role_config = self.get_role_config(role)
        if not role_config:
            return False
        permissions = role_config.get("permissions", [])
        if "*" in permissions:
            return True
        return permission in permissions

    def has_any_permission(self, roles: List[str], permission: str) -> bool:
        for r in roles:
            if r and self.has_permission(r, permission):
                return True
        return False

    def get_allowed_actions(self, role: str, current_state: str) -> List[str]:
        workflow_permissions = self.config.get("workflow_permissions", {})
        state_config = workflow_permissions.get(current_state, {})
        allowed_roles = state_config.get("allowed_roles", [])
        if role not in allowed_roles:
            return []
        return state_config.get("allowed_actions", [])

    def get_department_states(self, department: str) -> List[str]:
        mapping = self.config.get("department_to_state_mapping", {})
        if department == "all":
            return ["ALL_STATES"]
        return mapping.get(department, [])

    def get_service_department(self, service_type: str) -> str:
        mapping = self.config.get("service_to_department_mapping", {})
        return mapping.get(service_type, "verification")

    def can_access_application(
        self, role: str, department: str, application_state: str, application_service: str = None
    ) -> bool:
        if role == "super_admin":
            return True
        allowed_states = self.get_department_states(department)
        if "ALL_STATES" in allowed_states:
            return True
        return application_state in allowed_states

    def get_available_actions_for_user(self, role: str, current_state: str) -> List[str]:
        return self.get_allowed_actions(role, current_state)

    def create_custom_role(self, role_data: Dict[str, Any]) -> Dict[str, Any]:
        role_id = (role_data.get("role_id") or role_data.get("role_name") or "").lower().replace(" ", "_")
        if not role_id:
            raise ValueError("role_id is required")

        row = {
            "role_name": role_id,
            "display_name": role_data.get("name") or role_id,
            "description": role_data.get("description", ""),
            "permissions": role_data.get("permissions", []),
            "departments": role_data.get("departments", []),
            "can_assign_roles": role_data.get("can_assign_roles", False),
            "priority": role_data.get("priority", 1),
            "is_system_role": False,
        }
        if self._use_db:
            supabase.table("roles").upsert(row, on_conflict="role_name").execute()
        else:
            self.config.setdefault("roles", {})[role_id] = {
                "name": row["display_name"],
                "description": row["description"],
                "permissions": row["permissions"],
                "departments": row["departments"],
                "can_assign_roles": row["can_assign_roles"],
                "priority": row["priority"],
            }
            self._save_file()
        self.reload()
        return {"role_id": role_id, **row}

    def update_role_permissions(self, role_id: str, permissions: List[str]) -> bool:
        if role_id not in self.config.get("roles", {}):
            return False
        if self._use_db:
            supabase.table("roles").update({"permissions": permissions}).eq("role_name", role_id).execute()
        else:
            self.config["roles"][role_id]["permissions"] = permissions
            self._save_file()
        self.reload()
        return True

    def update_role_row(self, role_id: str, updates: Dict[str, Any]) -> bool:
        if self._use_db:
            allowed = {
                "display_name": "display_name",
                "description": "description",
                "permissions": "permissions",
                "departments": "departments",
                "priority": "priority",
                "can_assign_roles": "can_assign_roles",
            }
            db_updates = {db_k: updates[src_k] for src_k, db_k in allowed.items() if src_k in updates}
            if not db_updates:
                return False
            supabase.table("roles").update(db_updates).eq("role_name", role_id).execute()
        else:
            if role_id not in self.config.get("roles", {}):
                return False
            r = self.config["roles"][role_id]
            if "display_name" in updates:
                r["name"] = updates["display_name"]
            for k in ("description", "permissions", "departments", "priority", "can_assign_roles"):
                if k in updates:
                    r[k] = updates[k]
            self._save_file()
        self.reload()
        return True

    def add_workflow_permission(self, state: str, role: str, actions: List[str]) -> bool:
        if "workflow_permissions" not in self.config:
            self.config["workflow_permissions"] = {}
        if state not in self.config["workflow_permissions"]:
            self.config["workflow_permissions"][state] = {"allowed_roles": [], "allowed_actions": []}
        st = self.config["workflow_permissions"][state]
        if role not in st["allowed_roles"]:
            st["allowed_roles"].append(role)
        for a in actions:
            if a not in st["allowed_actions"]:
                st["allowed_actions"].append(a)
        if self._use_db:
            supabase.table("app_settings").upsert(
                {"key": "workflow_permissions", "value": self.config["workflow_permissions"]},
                on_conflict="key",
            ).execute()
        else:
            self._save_file()
        self.reload()
        return True

    def _save_file(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2)


role_manager = RoleManager()
