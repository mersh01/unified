from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timedelta
import json
from pathlib import Path

class WorkflowEngine:
    """Workflow management engine - Config-driven with hierarchy support"""

    def __init__(self, config_path: str = "config/workflows.json", hierarchy_path: str = "config/hierarchy.json"):
        self.config_path = Path(__file__).parent.parent / config_path
        self.hierarchy_path = Path(__file__).parent.parent / hierarchy_path
        self.workflows: Dict[str, Any] = {}
        self.hierarchy_config: Dict[str, Any] = {}
        self.service_level_mapping: Dict[str, Any] = {}
        self.reload()

    def reload(self) -> None:
        if self._hydrate_from_db():
            return
        self.workflows = self._load_workflows()
        self.hierarchy_config = self._load_hierarchy_config()
        self.service_level_mapping = self._load_service_level_mapping()

    def _hydrate_from_db(self) -> bool:
        try:
            from .supabase_client import supabase

            res = supabase.table("workflow_definitions").select("*").eq("is_active", True).execute()
            rows = res.data or []
            if not rows:
                return False
            self.workflows = {}
            for row in rows:
                name = row["workflow_name"]
                definition = row.get("definition") or {}
                self.workflows[name] = definition
            sl = supabase.table("app_settings").select("value").eq("key", "service_level_mapping").limit(1).execute()
            if sl.data:
                self.service_level_mapping = sl.data[0]["value"] or {}
            else:
                self.service_level_mapping = self._load_service_level_mapping()
            h = supabase.table("app_settings").select("value").eq("key", "hierarchy").limit(1).execute()
            if h.data:
                self.hierarchy_config = h.data[0]["value"] or {}
            else:
                self.hierarchy_config = self._load_hierarchy_config()
            return True
        except Exception as e:
            print(f"WorkflowEngine: database load failed ({e}), using files")
            return False
    
    def _load_workflows(self) -> Dict[str, Any]:
        """Load workflows from configuration file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                return config.get('workflows', {})
        except FileNotFoundError:
            print(f"Workflow config not found at {self.config_path}")
            return self._get_default_workflows()
        except json.JSONDecodeError as e:
            print(f"Error parsing workflow config: {e}")
            return self._get_default_workflows()
    
    def _load_hierarchy_config(self) -> Dict[str, Any]:
        """Load hierarchy configuration"""
        try:
            with open(self.hierarchy_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"levels": ["country", "region", "zone", "woreda", "kebele"]}
    
    def _load_service_level_mapping(self) -> Dict[str, Any]:
        """Load service level mapping from services config"""
        try:
            services_path = Path(__file__).parent.parent / "config" / "services.json"
            with open(services_path, 'r') as f:
                config = json.load(f)
                return config.get('service_level_mapping', {})
        except FileNotFoundError:
            return {}
    
    def _get_default_workflows(self) -> Dict[str, Any]:
        """Return default workflows with dictionary format"""
        return {
            "standard_document_workflow": {
                "states": {
                    "SUBMITTED": {"actions": ["PROCESS", "REJECT"], "next_states": {"PROCESS": "VERIFICATION", "REJECT": "REJECTED"}},
                    "VERIFICATION": {"actions": ["APPROVE", "REQUEST_INFO", "REJECT"], "next_states": {"APPROVE": "DOCUMENT_VERIFICATION", "REQUEST_INFO": "VERIFICATION", "REJECT": "REJECTED"}},
                    "DOCUMENT_VERIFICATION": {"actions": ["APPROVE", "REJECT", "REQUEST_ADDITIONAL_DOCS"], "next_states": {"APPROVE": "PAYMENT_PENDING", "REJECT": "REJECTED", "REQUEST_ADDITIONAL_DOCS": "DOCUMENT_VERIFICATION"}},
                    "PAYMENT_PENDING": {"actions": ["MAKE_PAYMENT", "CANCEL"], "next_states": {"MAKE_PAYMENT": "PAYMENT_COMPLETED", "CANCEL": "REJECTED"}},
                    "PAYMENT_COMPLETED": {"actions": ["GENERATE_CERTIFICATE"], "next_states": {"GENERATE_CERTIFICATE": "CERTIFICATE_GENERATED"}},
                    "CERTIFICATE_GENERATED": {"actions": ["DISPATCH", "EMAIL"], "next_states": {"DISPATCH": "COMPLETED", "EMAIL": "COMPLETED"}},
                    "COMPLETED": {"actions": [], "next_states": {}},
                    "REJECTED": {"actions": ["APPEAL"], "next_states": {"APPEAL": "VERIFICATION"}}
                },
                "sla_days": {"VERIFICATION": 3, "DOCUMENT_VERIFICATION": 5, "CERTIFICATE_GENERATED": 2}
            }
        }
    
    def get_service_required_level(self, service_type: str) -> str:
        """Get the minimum hierarchy level required for a service"""
        service_config = self.service_level_mapping.get(service_type, {})
        return service_config.get('level', 'country')
    
    def get_service_responsible_hierarchy(self, service_type: str) -> List[str]:
        """Get hierarchy levels responsible for this service"""
        service_config = self.service_level_mapping.get(service_type, {})
        return service_config.get('responsible_hierarchy', ['country'])
    
    def can_user_access_service(self, user_hierarchy: Dict[str, Any], service_type: str) -> bool:
        """Check if user can access a service based on their hierarchy level"""
        required_level = self.get_service_required_level(service_type)
        user_level = self.get_user_highest_level(user_hierarchy)
        
        level_order = ["kebele", "woreda", "zone", "region", "country"]
        
        try:
            user_index = level_order.index(user_level)
            required_index = level_order.index(required_level)
            return user_index >= required_index
        except ValueError:
            return False
    
    def get_user_highest_level(self, user_hierarchy: Dict[str, Any]) -> str:
        """Get the highest non-null level in user's hierarchy"""
        level_order = ["country", "region", "zone", "woreda", "kebele"]
        for level in level_order:
            if user_hierarchy.get(level):
                return level
        return "kebele"
    
    def can_user_access_application(self, user_hierarchy: Dict[str, Any], application_hierarchy: Dict[str, Any], service_type: str) -> bool:
        """Check if user can access a specific application based on hierarchy"""
        # First check if user can access this service type at all
        if not self.can_user_access_service(user_hierarchy, service_type):
            return False
        
        # Then check if user is in the correct geographic location
        required_level = self.get_service_required_level(service_type)
        
        # For services at a specific level, user must match that level's location
        if required_level == "zone":
            return user_hierarchy.get('zone') == application_hierarchy.get('zone')
        elif required_level == "woreda":
            return user_hierarchy.get('woreda') == application_hierarchy.get('woreda')
        elif required_level == "kebele":
            return user_hierarchy.get('kebele') == application_hierarchy.get('kebele')
        elif required_level == "region":
            return user_hierarchy.get('region') == application_hierarchy.get('region')
        else:  # country level
            return True
    
    def get_next_actions(
        self,
        workflow_name: str,
        current_state: str,
        user_roles: List[str] = None,
        user_hierarchy: Dict[str, Any] = None,
        service_type: str = None,
        user_permissions: List[str] = None,
    ) -> List[str]:
        """Get available actions for current state considering hierarchy and user roles"""
        workflow = self.get_workflow(workflow_name)
        states = workflow.get('states', {})
        state_config = states.get(current_state)
        
        if not state_config:
            return []
        
        actions = state_config.get('actions', [])
        
        # Hierarchy restrictions
        if user_hierarchy is not None:
            allowed_hierarchy_levels = state_config.get('allowed_hierarchy_levels', [])
            user_level = self.get_user_highest_level(user_hierarchy)
            if allowed_hierarchy_levels and user_level not in allowed_hierarchy_levels:
                return []

        # Permission-based access control
        allowed_permissions = state_config.get('allowed_permissions') or []

        if allowed_permissions and user_permissions is not None:
            # User must have at least one of the allowed permissions
            # If no overlap, return empty list
            if not set(user_permissions) & set(allowed_permissions):
                return []
            
            # Granular permission check for specific actions
            # Map actions to their required permissions based on action name
            action_permission_map = {
                'RESOLVE': 'resolve_complaints',
                'REASSIGN': 'reassign_complaints',
                'ASSIGN_TO_LME': 'assign_complaints',
                'REJECT': 'reject_complaints',
                'PROCESS': 'verify_applications',
                'APPROVE': 'verify_applications',
                'REQUEST_INFO': 'verify_applications',
                'REQUEST_ADDITIONAL_DOCS': 'verify_documents',
                'MAKE_PAYMENT': 'process_payments',
                'GENERATE_CERTIFICATE': 'issue_certificates',
                'DISPATCH': 'dispatch_certificates',
                'EMAIL': 'dispatch_certificates',
                'APPEAL': 'appeal_decision',
                'RATE': 'rate_service',
                'REOPEN': 'reopen_complaint',
                'REQUEST_SITE_VISIT': 'verify_applications',
            }
            
            # Filter actions based on specific permissions
            filtered_actions = []
            for action in actions:
                required_perm = action_permission_map.get(action)
                if required_perm:
                    # If action has a specific permission mapping, check if user has it
                    if required_perm in user_permissions:
                        filtered_actions.append(action)
                else:
                    # If no specific mapping, allow if user has any of the state's allowed permissions
                    filtered_actions.append(action)
            
            return filtered_actions
        elif not allowed_permissions:
            # No permissions defined on this state means no one can act (except super admin above)
            if actions:
                return []

        return actions
    
    def transition(self, workflow_name: str, current_state: str, action: str, application_data: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Transition to next state based on action in a specific workflow"""
        workflow = self.get_workflow(workflow_name)
        states = workflow.get('states', {})
        state_config = states.get(current_state)
        
        if not state_config:
            return None, f"Invalid state: {current_state}", None
        
        if action not in state_config.get('actions', []):
            return None, f"Action '{action}' not allowed in state '{current_state}' for workflow '{workflow_name}'", None
        
        # Get next state from next_states mapping
        next_states = state_config.get('next_states', {})
        next_state = next_states.get(action, current_state)
        
        # Check SLA
        sla_warning = None
        sla_days = workflow.get('sla_days', {})
        if current_state in sla_days:
            created_at = application_data.get('created_at')
            if created_at:
                submitted_date = datetime.fromisoformat(created_at)
                deadline = submitted_date + timedelta(days=sla_days[current_state])
                if datetime.now() > deadline:
                    sla_warning = f"SLA breached for state '{current_state}' (exceeded {sla_days[current_state]} days)"
        
        notification = f"Application moved from {current_state} to {next_state} via {action}"
        
        return next_state, notification, sla_warning
    
    def get_workflow(self, workflow_name: str) -> Dict[str, Any]:
        """Get workflow configuration by name"""
        workflow = self.workflows.get(workflow_name, self.workflows.get("standard_document_workflow", {}))
        if 'states' in workflow:
            workflow['states'] = self._normalize_states(workflow['states'])
        return workflow
    
    def _normalize_states(self, states: Any) -> Dict[str, Any]:
        """Convert states from list format to dictionary format if needed"""
        if isinstance(states, list):
            normalized = {}
            for state in states:
                state_name = state.get('name')
                if state_name:
                    state_copy = state.copy()
                    if 'name' in state_copy:
                        del state_copy['name']
                    normalized[state_name] = state_copy
            return normalized
        return states

        
    def get_action_definitions(self) -> Dict[str, Any]:
        """Get action dynamic payload definitions"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                return config.get('action_definitions', {})
        except Exception:
            return {}