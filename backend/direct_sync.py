#!/usr/bin/env python3
"""
Direct sync script that calls the same logic as the API endpoint
This bypasses the HTTP layer and runs the sync logic directly
"""

import json
import os
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def sync_workflow_permissions_direct():
    """Direct sync without HTTP - same logic as the API endpoint"""
    
    try:
        config_dir = Path(__file__).parent / "config"
        
        # Load all workflow files
        workflows = {}
        for file_path in config_dir.glob("wf_*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    workflow_name = data.get('workflow_name', file_path.stem)
                    workflows[workflow_name] = data.get('definition', data)
                    print(f"Loaded workflow: {workflow_name}")
            except Exception as e:
                print(f"Error loading {file_path}: {e}")
        
        print(f"Found {len(workflows)} workflow files")
        
        # Extract permissions from workflows
        workflow_permissions = {}
        for workflow_name, workflow_data in workflows.items():
            states = workflow_data.get('states', {})
            
            for state_name, state_config in states.items():
                if state_name not in workflow_permissions:
                    workflow_permissions[state_name] = {
                        "allowed_permissions": set(),
                        "allowed_actions": set()
                    }
                
                allowed_perms = state_config.get('allowed_permissions', [])
                if allowed_perms:
                    workflow_permissions[state_name]["allowed_permissions"].update(allowed_perms)
                
                allowed_actions = state_config.get('actions', [])
                if allowed_actions:
                    workflow_permissions[state_name]["allowed_actions"].update(allowed_actions)
        
        # Convert sets to lists
        for state_name in workflow_permissions:
            workflow_permissions[state_name]["allowed_permissions"] = sorted(list(workflow_permissions[state_name]["allowed_permissions"]))
            workflow_permissions[state_name]["allowed_actions"] = sorted(list(workflow_permissions[state_name]["allowed_actions"]))
        
        print(f"Extracted permissions for {len(workflow_permissions)} states")
        
        # Load roles.json
        roles_path = config_dir / "roles.json"
        with open(roles_path, 'r', encoding='utf-8') as f:
            roles_data = json.load(f)
        
        # Update workflow_permissions in roles.json
        roles_data['workflow_permissions'] = workflow_permissions
        
        # Save roles.json
        with open(roles_path, 'w', encoding='utf-8') as f:
            json.dump(roles_data, f, indent=2)
        print("✅ Updated roles.json")
        
        # Update database
        try:
            # Import dotenv first
            import dotenv
            # Load environment variables
            dotenv_path = Path(__file__).parent / ".env"
            dotenv.load_dotenv(dotenv_path)
            
            from supabase_client import supabase
            supabase.table("app_settings").upsert(
                {"key": "workflow_permissions", "value": workflow_permissions},
                on_conflict="key",
            ).execute()
            print("✅ Updated database app_settings")
        except Exception as e:
            print(f"⚠️  Could not update database: {e}")
            import traceback
            traceback.print_exc()
        
        # Reload role_manager
        try:
            from role_manager import role_manager
            role_manager.reload()
            print("✅ Reloaded role_manager")
        except Exception as e:
            print(f"⚠️  Could not reload role_manager: {e}")
        
        print()
        print("="*70)
        print("✅ SYNC COMPLETED")
        print("="*70)
        print(f"Updated {len(workflow_permissions)} workflow states")
        print()
        print("Permissions now available:")
        for state in sorted(workflow_permissions.keys()):
            perms = workflow_permissions[state].get('allowed_permissions', [])
            if perms:
                print(f"  {state}: {', '.join(perms)}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("="*70)
    print("DIRECT WORKFLOW PERMISSIONS SYNC")
    print("="*70)
    print()
    
    success = sync_workflow_permissions_direct()
    
    sys.exit(0 if success else 1)
