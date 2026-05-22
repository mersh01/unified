import json
from pathlib import Path
from typing import Dict, Any, List, Optional


class ConfigEngine:
    """Configuration-driven engine for document management with hierarchy support"""

    def __init__(self, config_path: str = "config/documents.json", hierarchy_path: str = "config/hierarchy.json"):
        self.config_path = Path(__file__).parent.parent / config_path
        self.hierarchy_path = Path(__file__).parent.parent / hierarchy_path
        self._use_db = False
        self.config: Dict[str, Any] = {}
        self.hierarchy_config: Dict[str, Any] = {}
        self.service_level_mapping: Dict[str, Any] = {}
        self.reload()

    def reload(self) -> None:
        if self._hydrate_from_db():
            return
        self.config = self._load_config()
        self.hierarchy_config = self._load_hierarchy_config()
        self.service_level_mapping = self._load_service_level_mapping()
        self._use_db = False

    def _hydrate_from_db(self) -> bool:
        try:
            from .supabase_client import supabase

            res = supabase.table("service_definitions").select("*").eq("is_active", True).execute()
            rows = res.data or []
            if not rows:
                return False
            self.config = {"documents": {}, "services": {}}
            for row in rows:
                cfg = row.get("config") or {}
                sid = row["service_id"]
                kind = row["service_kind"]
                if kind == "document":
                    self.config["documents"][sid] = cfg
                else:
                    self.config["services"][sid] = cfg
            h = supabase.table("app_settings").select("value").eq("key", "hierarchy").limit(1).execute()
            if h.data:
                self.hierarchy_config = h.data[0]["value"] or {}
            else:
                self.hierarchy_config = self._load_hierarchy_config()
            sl = supabase.table("app_settings").select("value").eq("key", "service_level_mapping").limit(1).execute()
            if sl.data:
                self.service_level_mapping = sl.data[0]["value"] or {}
            else:
                self.service_level_mapping = self._load_service_level_mapping()
            self._use_db = True
            return True
        except Exception as e:
            print(f"ConfigEngine: database load failed ({e}), using files")
            return False
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return self._get_default_config()
    
    def _load_hierarchy_config(self) -> Dict[str, Any]:
        """Load hierarchy configuration"""
        try:
            with open(self.hierarchy_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {"levels": ["country", "region", "zone", "woreda", "kebele"]}
    
    def _load_service_level_mapping(self) -> Dict[str, Any]:
        """Load service level mapping"""
        try:
            services_path = Path(__file__).parent.parent / "config" / "services.json"
            with open(services_path, 'r') as f:
                config = json.load(f)
                return config.get('service_level_mapping', {})
        except FileNotFoundError:
            return {}
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration"""
        return {
            "documents": {},
            "services": {}
        }
    
    def get_service_level(self, service_id: str) -> str:
        """Get the hierarchy level at which this service operates"""
        level_config = self.service_level_mapping.get(service_id, {})
        return level_config.get('level', 'country')
    
    def get_service_responsible_hierarchy(self, service_id: str) -> List[str]:
        """Get hierarchy levels responsible for this service"""
        level_config = self.service_level_mapping.get(service_id, {})
        return level_config.get('responsible_hierarchy', ['country'])
    
    def get_services_for_hierarchy_level(self, level: str) -> List[str]:
        """Get all services that can be accessed at a given hierarchy level"""
        services = []
        for service_id, config in self.service_level_mapping.items():
            if level in config.get('responsible_hierarchy', []):
                services.append(service_id)
        return services
    
    def get_all_services(self, user_hierarchy: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get ALL services, optionally filtered by user's hierarchy"""
        all_services = []
        
        # Add document types
        for service_id, config in self.config.get('documents', {}).items():
            service_data = {
                "service_id": service_id,
                "service_type": "document",
                "name": config.get('name'),
                "description": config.get('description'),
                "category": config.get('category', 'document'),
                "fee_amount": config.get('fee_amount'),
                "processing_time_days": config.get('processing_time_days'),
                "required_level": self.get_service_level(service_id)
            }
            
            # Filter by user hierarchy if provided
            if user_hierarchy:
                user_level = self._get_user_hierarchy_level(user_hierarchy)
                required_level = service_data['required_level']
                if self._can_user_access_level(user_level, required_level):
                    all_services.append(service_data)
            else:
                all_services.append(service_data)
        
        # Add other services
        for service_id, config in self.config.get('services', {}).items():
            service_data = {
                "service_id": service_id,
                "service_type": "service",
                "name": config.get('name'),
                "description": config.get('description'),
                "category": config.get('category', 'service'),
                "fee_amount": config.get('fee_amount'),
                "processing_time_days": config.get('processing_time_days'),
                "required_level": self.get_service_level(service_id)
            }
            
            if user_hierarchy:
                user_level = self._get_user_hierarchy_level(user_hierarchy)
                required_level = service_data['required_level']
                if self._can_user_access_level(user_level, required_level):
                    all_services.append(service_data)
            else:
                all_services.append(service_data)
        
        return all_services
    
    def _get_user_hierarchy_level(self, user_hierarchy: Dict[str, Any]) -> str:
        """Get the user's hierarchy level"""
        level_order = ["country", "region", "zone", "woreda", "kebele"]
        for level in level_order:
            if user_hierarchy.get(level):
                return level
        return "kebele"
    
    def _can_user_access_level(self, user_level: str, required_level: str) -> bool:
        """Check if user can access a service at required level"""
        level_order = ["kebele", "woreda", "zone", "region", "country"]
        try:
            user_index = level_order.index(user_level)
            required_index = level_order.index(required_level)
            return user_index >= required_index
        except ValueError:
            return False
    
    def get_hierarchical_fields(self, service_id: str) -> Dict[str, Any]:
        """Get hierarchical field configuration for a service"""
        service_config = self.get_service_config(service_id)
        if not service_config:
            return {}
        return service_config.get('hierarchical_fields', {})
    
    def get_hierarchy_data(self, level: str = None, parent_id: str = None) -> Dict[str, Any]:
        """Get hierarchy data for dropdowns"""
        if level == "regions":
            return {region_id: region_data["name"] for region_id, region_data in self.hierarchy_config.get("regions", {}).items()}
        elif level == "zones" and parent_id:
            region_data = self.hierarchy_config.get("regions", {}).get(parent_id.lower(), {})
            return {zone_id: zone_data["name"] for zone_id, zone_data in region_data.get("zones", {}).items()}
        elif level == "woredas" and parent_id:
            # Find the zone with the given parent_id across all regions
            for region_data in self.hierarchy_config.get("regions", {}).values():
                zones = region_data.get("zones", {})
                # Case-insensitive search
                parent_key = parent_id.lower()
                if parent_key in zones:
                    zone_data = zones[parent_key]
                    return {woreda_id: woreda_data["name"] for woreda_id, woreda_data in zone_data.get("woredas", {}).items()}
            return {}
        elif level == "kebeles" and parent_id:
            # Find the woreda with the given parent_id across all zones
            for region_data in self.hierarchy_config.get("regions", {}).values():
                for zone_data in region_data.get("zones", {}).values():
                    woredas = zone_data.get("woredas", {})
                    # Case-insensitive search
                    parent_key = parent_id.lower()
                    if parent_key in woredas:
                        woreda_data = woredas[parent_key]
                        return {kebele: kebele for kebele in woreda_data.get("kebeles", [])}
            return {}
        else:
            return self.hierarchy_config
    
    def get_service_responsible_hierarchy(self, service_id: str) -> List[str]:
        """Get the hierarchy levels responsible for this service"""
        level_config = self.service_level_mapping.get(service_id, {})
        return level_config.get('responsible_hierarchy', ['country'])

    
    def get_service_config(self, service_id: str) -> Optional[Dict[str, Any]]:
        """Get configuration for ANY service by ID"""
        if service_id in self.config.get('documents', {}):
            config = self.config['documents'][service_id]
        elif service_id in self.config.get('services', {}):
            config = self.config['services'][service_id]
        else:
            return None
        
        # Add hierarchy information
        config['required_level'] = self.get_service_level(service_id)
        config['responsible_hierarchy'] = self.get_service_responsible_hierarchy(service_id)
        
        return config
    
    def get_document_config(self, doc_type: str) -> Optional[Dict[str, Any]]:
        """Get configuration for specific document type (backward compatible)"""
        documents = self.config.get('documents', {})
        return documents.get(doc_type)
    
    def get_services_by_category(self, category: str, user_hierarchy: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get services filtered by category and hierarchy"""
        all_services = self.get_all_services(user_hierarchy)
        if category == "all":
            return all_services
        return [s for s in all_services if s.get('category') == category]
    
    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all available categories with counts"""
        categories = {}
        for service in self.get_all_services():
            cat = service.get('category', 'other')
            categories[cat] = categories.get(cat, 0) + 1
        
        return [
            {"id": "all", "name": "All Services", "count": len(self.get_all_services())},
            {"id": "document_replacement", "name": "Document Replacement", "count": categories.get('document_replacement', 0)},
            {"id": "educational", "name": "Educational", "count": categories.get('educational', 0)},
            {"id": "government_service", "name": "Government Services", "count": categories.get('government_service', 0)},
            {"id": "financial", "name": "Financial", "count": categories.get('financial', 0)},
            {"id": "transport", "name": "Transport", "count": categories.get('transport', 0)},
            {"id": "tax", "name": "Tax Services", "count": categories.get('tax', 0)},
            {"id": "certificate", "name": "Certificates", "count": categories.get('certificate', 0)}
        ]
    
    def get_required_fields(self, service_id: str) -> List[str]:
        """Get required fields for a service"""
        config = self.get_service_config(service_id)
        return config.get('required_fields', []) if config else []
    
    def get_optional_fields(self, service_id: str) -> List[str]:
        """Get optional fields for a service"""
        config = self.get_service_config(service_id)
        return config.get('optional_fields', []) if config else []
    
    def get_field_label(self, service_id: str, field: str) -> str:
        """Get label for a specific field"""
        config = self.get_service_config(service_id)
        if config:
            # Check in steps for multi-step services
            if config.get("multi_step", {}).get("enabled"):
                steps = config.get("steps", [])
                for step in steps:
                    fields = step.get("fields", [])
                    for f in fields:
                        if f.get("name") == field:
                            return f.get("label", field.replace('_', ' ').title())
            # Fallback to old field_labels
            labels = config.get('field_labels', {})
            return labels.get(field, field.replace('_', ' ').title())
        return field
    
    def get_fee_amount(self, service_id: str) -> float:
        """Get fee amount for service"""
        config = self.get_service_config(service_id)
        return config.get('fee_amount', 0) if config else 0
    
    def get_processing_time(self, service_id: str) -> int:
        """Get processing time in days"""
        config = self.get_service_config(service_id)
        return config.get('processing_time_days', 7) if config else 7
    
    def get_workflow_name(self, service_id: str) -> str:
        """Get workflow name for service"""
        config = self.get_service_config(service_id)
        return config.get('workflow', 'standard_document_workflow') if config else 'standard_document_workflow'
    
    def validate_form_data(self, service_id: str, form_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate form data against configuration"""
        errors = []
        service_config = self.get_service_config(service_id)
        if not service_config:
            return False, ["Service not found"]
        
        required_fields = []
        
        if service_config.get("multi_step", {}).get("enabled"):
            # For multi-step services, collect required fields from all steps
            steps = service_config.get("steps", [])
            for step in steps:
                fields = step.get("fields", [])
                for field in fields:
                    if field.get("required", False):
                        required_fields.append(field["name"])
        else:
            # Fallback to old method
            required_fields = self.get_required_fields(service_id)
        
        for field in required_fields:
            if field not in form_data or not form_data[field]:
                label = self.get_field_label(service_id, field)
                errors.append(f"{label} is required")
        
        return len(errors) == 0, errors

    def get_available_documents(self) -> List[str]:
        """List document-type service IDs (backward compatible API)."""
        return list(self.config.get("documents", {}).keys())