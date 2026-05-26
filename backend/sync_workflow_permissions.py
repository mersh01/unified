#!/usr/bin/env python3
"""
Script to sync workflow permissions from workflow JSON files to roles.json
This extracts all allowed_permissions from all workflow states and updates the workflow_permissions config
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Set

def load_workflow_files(config_dir: str = "config") -> Dict[str, Any]:
    """Load all workflow JSON files"""
    workflows = {}
    config_path = Path(__file__).parent / config_dir
    
    for file_path in config_path.glob("wf_*.json"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                workflow_name = data.get('workflow_name', file_path.stem)
                workflows[workflow_name] = data.get('definition', data)
                print(f"Loaded workflow: {workflow_name}")
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
    
    return workflows

def extract_permissions_from_workflows(workflows: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
    """Extract all permissions and actions from workflow states"""
    workflow_permissions = {}
    
    for workflow_name, workflow_data in workflows.items():
        states = workflow_data.get('states', {})
        
        for state_name, state_config in states.items():
            if state_name not in workflow_permissions:
                workflow_permissions[state_name] = {
                    "allowed_permissions": set(),
                    "allowed_actions": set()
                }
            
            # Extract allowed_permissions
            allowed_perms = state_config.get('allowed_permissions', [])
            if allowed_perms:
                workflow_permissions[state_name]["allowed_permissions"].update(allowed_perms)
            
            # Extract allowed_actions
            allowed_actions = state_config.get('actions', [])
            if allowed_actions:
                workflow_permissions[state_name]["allowed_actions"].update(allowed_actions)
    
    # Convert sets to lists for JSON serialization
    for state_name in workflow_permissions:
        workflow_permissions[state_name]["allowed_permissions"] = sorted(list(workflow_permissions[state_name]["allowed_permissions"]))
        workflow_permissions[state_name]["allowed_actions"] = sorted(list(workflow_permissions[state_name]["allowed_actions"]))
    
    return workflow_permissions

def load_roles_json(config_dir: str = "config") -> Dict[str, Any]:
    """Load the roles.json file"""
    roles_path = Path(__file__).parent / config_dir / "roles.json"
    
    try:
        with open(roles_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading roles.json: {e}")
        return {}

def save_roles_json(data: Dict[str, Any], config_dir: str = "config"):
    """Save the roles.json file"""
    roles_path = Path(__file__).parent / config_dir / "roles.json"
    
    try:
        with open(roles_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"✅ Saved updated roles.json")
        return True
    except Exception as e:
        print(f"Error saving roles.json: {e}")
        return False

def sync_workflow_permissions():
    """Main function to sync workflow permissions"""
    print("="*70)
    print("SYNC WORKFLOW PERMISSIONS")
    print("="*70)
    print()
    
    # Load workflow files
    print("Loading workflow files...")
    workflows = load_workflow_files()
    print(f"Found {len(workflows)} workflow files")
    print()
    
    # Extract permissions
    print("Extracting permissions from workflows...")
    extracted_permissions = extract_permissions_from_workflows(workflows)
    print(f"Found {len(extracted_permissions)} unique states")
    print()
    
    # Load existing roles.json
    print("Loading existing roles.json...")
    roles_data = load_roles_json()
    
    # Display current vs extracted
    print("Current workflow_permissions in roles.json:")
    current_perms = roles_data.get('workflow_permissions', {})
    for state in sorted(current_perms.keys()):
        print(f"  - {state}: {current_perms[state].get('allowed_permissions', [])}")
    print()
    
    print("Extracted workflow_permissions from workflow files:")
    for state in sorted(extracted_permissions.keys()):
        print(f"  - {state}: {extracted_permissions[state].get('allowed_permissions', [])}")
    print()
    
    # Update roles.json
    print("Updating roles.json with extracted permissions...")
    roles_data['workflow_permissions'] = extracted_permissions
    
    if save_roles_json(roles_data):
        print()
        print("="*70)
        print("✅ SUCCESS")
        print("="*70)
        print("Workflow permissions have been synced from workflow JSON files")
        print("The role permission checklist will now show all workflow-based permissions")
        print()
        print("Next steps:")
        print("1. Restart the backend server to load the updated permissions")
        print("2. Check the role permission checklist to verify new permissions appear")
        return True
    else:
        print()
        print("="*70)
        print("❌ FAILED")
        print("="*70)
        return False

if __name__ == "__main__":
    import sys
    success = sync_workflow_permissions()
    sys.exit(0 if success else 1)
