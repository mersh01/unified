"""
One-time / startup seed: copy JSON config files into Supabase when tables are empty.
"""
import json
from pathlib import Path
from typing import Any, Dict
from datetime import datetime

CONFIG_DIR = Path(__file__).parent.parent / "config"


def _load_json(name: str) -> Dict[str, Any]:
    path = CONFIG_DIR / name
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_if_empty() -> bool:
    """Return True if seeding ran and inserted data."""
    try:
        from .supabase_client import supabase
    except Exception as e:
        print(f"config_seed: cannot import supabase: {e}")
        return False

    try:
        check = supabase.table("service_definitions").select("service_id").limit(1).execute()
        if check.data:
            return False
    except Exception as e:
        print(f"config_seed: service_definitions not available ({e}). Run backend/supabase_config_tables.sql")
        return False

    now = datetime.utcnow().isoformat() + "Z"
    documents = _load_json("documents.json")

    rows = []
    for sid, cfg in documents.get("documents", {}).items():
        rows.append(
            {
                "service_id": sid,
                "service_kind": "document",
                "config": cfg,
                "is_active": True,
                "updated_at": now,
            }
        )
    for sid, cfg in documents.get("services", {}).items():
        rows.append(
            {
                "service_id": sid,
                "service_kind": "service",
                "config": cfg,
                "is_active": True,
                "updated_at": now,
            }
        )
    if rows:
        supabase.table("service_definitions").insert(rows).execute()
        print(f"config_seed: inserted {len(rows)} service_definitions")

    wf_file = _load_json("workflows.json")
    wf_rows = []
    for name, definition in wf_file.get("workflows", {}).items():
        wf_rows.append({"workflow_name": name, "definition": definition, "is_active": True, "updated_at": now})
    if wf_rows:
        supabase.table("workflow_definitions").insert(wf_rows).execute()
        print(f"config_seed: inserted {len(wf_rows)} workflow_definitions")

    roles_file = _load_json("roles.json")
    services_file = _load_json("services.json")
    hierarchy_file = _load_json("hierarchy.json")

    settings_payloads = []
    if hierarchy_file:
        settings_payloads.append({"key": "hierarchy", "value": hierarchy_file, "updated_at": now})
    if services_file.get("service_level_mapping"):
        settings_payloads.append(
            {"key": "service_level_mapping", "value": services_file["service_level_mapping"], "updated_at": now}
        )
    if roles_file.get("workflow_permissions"):
        settings_payloads.append(
            {"key": "workflow_permissions", "value": roles_file["workflow_permissions"], "updated_at": now}
        )
    if roles_file.get("department_to_state_mapping"):
        settings_payloads.append(
            {"key": "department_to_state_mapping", "value": roles_file["department_to_state_mapping"], "updated_at": now}
        )
    if roles_file.get("service_to_department_mapping"):
        settings_payloads.append(
            {"key": "service_to_department_mapping", "value": roles_file["service_to_department_mapping"], "updated_at": now}
        )
    if settings_payloads:
        supabase.table("app_settings").insert(settings_payloads).execute()
        print(f"config_seed: inserted {len(settings_payloads)} app_settings rows")

    for role_id, role_data in roles_file.get("roles", {}).items():
        row = {
            "role_name": role_id,
            "display_name": role_data.get("name", role_id),
            "description": role_data.get("description", ""),
            "permissions": role_data.get("permissions", []),
            "departments": role_data.get("departments", []),
            "priority": role_data.get("priority", 0),
            "can_assign_roles": role_data.get("can_assign_roles", False),
            "is_system_role": role_id in ("super_admin", "citizen"),
            "updated_at": now,
        }
        try:
            supabase.table("roles").upsert(row, on_conflict="role_name").execute()
        except Exception as ex:
            print(f"config_seed: upsert role {role_id}: {ex}")

    print("config_seed: completed")
    return True


def _assigned_roles_from_workflow_definition(defn: dict) -> set:
    names = set()
    for state in (defn.get("states") or {}).values():
        if isinstance(state, dict) and state.get("assigned_role"):
            names.add(state["assigned_role"])
    return names


def ensure_workflow_roles_exist() -> None:
    """Insert any role named in workflow state assigned_role if it is missing from roles."""
    try:
        from .supabase_client import supabase
    except Exception as e:
        print(f"ensure_workflow_roles_exist: skip ({e})")
        return

    assigned: set = set()
    try:
        res = supabase.table("workflow_definitions").select("definition").execute()
        for row in res.data or []:
            assigned |= _assigned_roles_from_workflow_definition(row.get("definition") or {})
    except Exception as e:
        print(f"ensure_workflow_roles_exist: DB workflows unavailable ({e})")

    if not assigned:
        wf_file = _load_json("workflows.json")
        for blob in wf_file.get("workflows", {}).values():
            if isinstance(blob, dict):
                assigned |= _assigned_roles_from_workflow_definition(blob)

    now = datetime.utcnow().isoformat() + "Z"
    for role_name in sorted(assigned):
        try:
            existing = supabase.table("roles").select("role_name").eq("role_name", role_name).limit(1).execute()
            if existing.data:
                continue
            supabase.table("roles").insert(
                {
                    "role_name": role_name,
                    "display_name": role_name.replace("_", " ").title(),
                    "description": "Auto-created from workflow assigned_role",
                    "permissions": ["view_department_applications", "add_comments"],
                    "departments": [],
                    "priority": 40,
                    "can_assign_roles": False,
                    "is_system_role": False,
                    "updated_at": now,
                }
            ).execute()
            print(f"ensure_workflow_roles_exist: created role {role_name}")
        except Exception as ex:
            print(f"ensure_workflow_roles_exist: {role_name}: {ex}")


def ensure_admin_user_roles_link() -> None:
    """Ensure bootstrap admin has a user_roles row for super_admin (optional; primary role remains users.role)."""
    try:
        from .supabase_client import supabase

        supabase.table("user_roles").insert({"user_id": "ADMIN_001", "role_name": "super_admin"}).execute()
        print("ensure_admin_user_roles_link: inserted ADMIN_001 -> super_admin in user_roles")
    except Exception as ex:
        err = str(ex).lower()
        if "duplicate" in err or "unique" in err:
            return
        if "user_roles" in err or "does not exist" in err or "pgrst205" in err:
            print("ensure_admin_user_roles_link: user_roles table missing; run supabase_config_tables.sql")
            return
        print(f"ensure_admin_user_roles_link: {ex}")
