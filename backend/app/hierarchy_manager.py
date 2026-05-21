import json
from pathlib import Path
from typing import Dict, Any, List, Optional

from .role_manager import role_manager

class HierarchyManager:
    """Manages hierarchical organizational structure and access control"""
    
    def __init__(self, hierarchy_config_path: str = "config/hierarchy.json", 
                 departments_config_path: str = "config/departments.json"):
        self.hierarchy_path = Path(__file__).parent.parent / hierarchy_config_path
        self.departments_path = Path(__file__).parent.parent / departments_config_path
        self.hierarchy_config = self._load_hierarchy_config()
        self.departments_config = self._load_departments_config()
    
    def _load_hierarchy_config(self) -> Dict[str, Any]:
        try:
            with open(self.hierarchy_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"hierarchy_levels": [], "country": {}, "regions": {}}
    
    def _load_departments_config(self) -> Dict[str, Any]:
        try:
            with open(self.departments_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"departments": {}, "department_role_mapping": {}}
    
    def get_hierarchy_path(self, user: Dict[str, Any]) -> Dict[str, Any]:
        """Get the full hierarchy path for a user"""
        hierarchy = user.get("hierarchy", {})
        return {
            "country": hierarchy.get("country"),
            "region": hierarchy.get("region"),
            "zone": hierarchy.get("zone"),
            "level": hierarchy.get("level", "country")
        }
    
    def can_user_access_app(self, user: Dict[str, Any], app: Dict[str, Any]) -> bool:
        """Check if user can access an application based on hierarchy and department"""
        if user.get("role") == "super_admin":
            return True
        
        user_hierarchy = user.get("hierarchy", {})
        app_hierarchy = {
            "country": app.get("hierarchy_country"),
            "region": app.get("hierarchy_region"),
            "zone": app.get("hierarchy_zone"),
            "woreda": app.get("hierarchy_woreda"),
            "kebele": app.get("hierarchy_kebele")
        }
        
        # Get user's hierarchy level
        user_level = self.get_users_hierarchy_level(user)
        
        # Check hierarchy access based on user's level
        if user_level == "country":
            # Country level can see everything in their country
            return app_hierarchy.get("country") == user_hierarchy.get("country")
        elif user_level == "region":
            # Region level can see applications in their region or lower
            if app_hierarchy.get("region") and app_hierarchy.get("region") != user_hierarchy.get("region"):
                return False
            return app_hierarchy.get("country") == user_hierarchy.get("country")
        elif user_level == "zone":
            # Zone level can see applications in their zone or lower
            if app_hierarchy.get("zone") and app_hierarchy.get("zone") != user_hierarchy.get("zone"):
                return False
            if app_hierarchy.get("region") and app_hierarchy.get("region") != user_hierarchy.get("region"):
                return False
            return app_hierarchy.get("country") == user_hierarchy.get("country")
        elif user_level == "woreda":
            # Woreda level can see applications in their woreda or lower
            if app_hierarchy.get("woreda") and app_hierarchy.get("woreda") != user_hierarchy.get("woreda"):
                return False
            if app_hierarchy.get("zone") and app_hierarchy.get("zone") != user_hierarchy.get("zone"):
                return False
            if app_hierarchy.get("region") and app_hierarchy.get("region") != user_hierarchy.get("region"):
                return False
            return app_hierarchy.get("country") == user_hierarchy.get("country")
        elif user_level == "kebele":
            # Kebele level can see applications in their kebele
            if app_hierarchy.get("kebele") and app_hierarchy.get("kebele") != user_hierarchy.get("kebele"):
                return False
            if app_hierarchy.get("woreda") and app_hierarchy.get("woreda") != user_hierarchy.get("woreda"):
                return False
            if app_hierarchy.get("zone") and app_hierarchy.get("zone") != user_hierarchy.get("zone"):
                return False
            if app_hierarchy.get("region") and app_hierarchy.get("region") != user_hierarchy.get("region"):
                return False
            return app_hierarchy.get("country") == user_hierarchy.get("country")
        
        return False
    
    def get_accessible_applications(self, user: Dict[str, Any], applications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter applications that user can access based on hierarchy and department"""
        if user.get("type") == "user":
            return [app for app in applications if app.get('user_id') == user.get('user_id')]
        
        department = user.get('department')
        allowed_states = role_manager.get_department_states(department)
        
        filtered_apps = []
        for app in applications:
            if not self.can_user_access_app(user, app):
                continue
                
            # If the application is specifically assigned to someone
            assigned_to = app.get('assigned_to')
            user_id = user.get('user_id')
            role = user.get('role')
            
            if assigned_to and assigned_to != user_id and role not in ["super_admin", "system_admin", "gro"]:
                continue
                
            if "ALL_STATES" in allowed_states or role == "super_admin":
                filtered_apps.append(app)
                continue
            if app.get('current_state') in allowed_states:
                filtered_apps.append(app)
        
        return filtered_apps
    
    def get_users_hierarchy_level(self, user: Dict[str, Any]) -> str:
        """Get the hierarchy level where user operates"""
        hierarchy = user.get("hierarchy", {})
        return hierarchy.get("level", "country")
    
    def get_scope_for_hierarchy_level(self, level: str) -> List[str]:
        """Get scope fields for a hierarchy level"""
        scopes = {
            "country": ["country"],
            "region": ["country", "region"],
            "zone": ["country", "region", "zone"]
        }
        return scopes.get(level, ["country"])
    
    def can_access_department_at_level(self, department_id: str, user_level: str) -> bool:
        """Check if a department can be accessed at user's hierarchy level"""
        dept = self.departments_config.get("departments", {}).get(department_id, {})
        dept_level = dept.get("operating_level", "country")
        
        # User can access departments at same level or above their level
        hierarchy_order = {"country": 0, "region": 1, "zone": 2}
        user_level_order = hierarchy_order.get(user_level, 2)
        dept_level_order = hierarchy_order.get(dept_level, 0)
        
        # User can access if department is at same level or higher (lower order)
        return dept_level_order <= user_level_order
    
    def get_delegated_departments(self, parent_department_id: str) -> List[str]:
        """Get departments that inherit from parent"""
        departments = self.departments_config.get("departments", {})
        delegated = []
        
        for dept_id, dept in departments.items():
            if dept.get("parent_department") == parent_department_id:
                delegated.append(dept_id)
        
        return delegated
    
    def create_hierarchy_path_label(self, hierarchy: Dict[str, Any]) -> str:
        """Create a human-readable label for hierarchy path"""
        parts = []
        if hierarchy.get("country"):
            parts.append(f"Country: {hierarchy.get('country')}")
        if hierarchy.get("region"):
            parts.append(f"Region: {hierarchy.get('region')}")
        if hierarchy.get("zone"):
            parts.append(f"Zone: {hierarchy.get('zone')}")
        return " > ".join(parts) if parts else "Global"

    def is_in_admin_scope(self, admin_user: Dict[str, Any], target_hierarchy: Dict[str, Any], target_department: str = None) -> bool:
        """Check if a target user (defined by hierarchy and department) is within the admin's scope."""
        user_roles = admin_user.get("roles") or [admin_user.get("role")]
        if "super_admin" in user_roles or "system_admin" in user_roles:
            return True
            
        # Department check: If admin has a department, target must be in the same department
        admin_dept = admin_user.get("department")
        if admin_dept and target_department and admin_dept != target_department:
            return False
            
        admin_hierarchy = admin_user.get("hierarchy", {})
        if not admin_hierarchy:
            admin_hierarchy = {
                "country": admin_user.get("hierarchy_country"),
                "region": admin_user.get("hierarchy_region"),
                "zone": admin_user.get("hierarchy_zone"),
                "woreda": admin_user.get("hierarchy_woreda"),
                "kebele": admin_user.get("hierarchy_kebele")
            }
            
        # Define hierarchy levels from highest to lowest
        level_values = {
            "kebele": 1,
            "woreda": 2,
            "zone": 3,
            "region": 4,
            "country": 5
        }
        
        def is_val(v):
            return v is not None and str(v).strip() != ""
            
        def get_level(h):
            if is_val(h.get("kebele")): return "kebele"
            if is_val(h.get("woreda")): return "woreda"
            if is_val(h.get("zone")): return "zone"
            if is_val(h.get("region")): return "region"
            return "country"
            
        admin_level = admin_hierarchy.get("level")
        if not admin_level or admin_level not in level_values:
            admin_level = get_level(admin_hierarchy)
            
        target_level = get_level(target_hierarchy)
        
        # Enforce that target_level must be equal to or lower than admin_level
        # e.g., woreda level admin (2) can access woreda (2) or kebele (1)
        # but cannot access zone (3), region (4), or country (5).
        if level_values[target_level] > level_values[admin_level]:
            return False
            
        # Now check matching parent hierarchy values
        if admin_level == "country":
            return target_hierarchy.get("country") == admin_hierarchy.get("country")
        elif admin_level == "region":
            if target_hierarchy.get("region") != admin_hierarchy.get("region"):
                return False
            return target_hierarchy.get("country") == admin_hierarchy.get("country")
        elif admin_level == "zone":
            if target_hierarchy.get("zone") != admin_hierarchy.get("zone"):
                return False
            if target_hierarchy.get("region") != admin_hierarchy.get("region"):
                return False
            return target_hierarchy.get("country") == admin_hierarchy.get("country")
        elif admin_level == "woreda":
            if target_hierarchy.get("woreda") != admin_hierarchy.get("woreda"):
                return False
            if target_hierarchy.get("zone") != admin_hierarchy.get("zone"):
                return False
            if target_hierarchy.get("region") != admin_hierarchy.get("region"):
                return False
            return target_hierarchy.get("country") == admin_hierarchy.get("country")
        elif admin_level == "kebele":
            if target_hierarchy.get("kebele") != admin_hierarchy.get("kebele"):
                return False
            if target_hierarchy.get("woreda") != admin_hierarchy.get("woreda"):
                return False
            if target_hierarchy.get("zone") != admin_hierarchy.get("zone"):
                return False
            if target_hierarchy.get("region") != admin_hierarchy.get("region"):
                return False
            return target_hierarchy.get("country") == admin_hierarchy.get("country")
            
        return False

# Initialize global hierarchy manager
hierarchy_manager = HierarchyManager()
