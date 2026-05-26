#!/usr/bin/env python3
"""
Script to sync all workflow JSON files to the database.
This loads workflows from workflows.json and individual wf_*.json files
and inserts/updates them in the workflow_definitions table.
"""

import json
import glob
from pathlib import Path
import os
import sys

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from supabase_client import supabase

def sync_workflows_to_db():
    """Sync all workflow JSON files to the database"""
    
    config_dir = Path(__file__).parent / "config"
    workflows = {}
    
    # Load from main workflows.json file
    workflows_json_path = config_dir / "workflows.json"
    try:
        with open(workflows_json_path, 'r') as f:
            config = json.load(f)
            workflows.update(config.get('workflows', {}))
            print(f"✓ Loaded {len(config.get('workflows', {}))} workflows from workflows.json")
    except FileNotFoundError:
        print(f"⚠ workflows.json not found at {workflows_json_path}")
    except json.JSONDecodeError as e:
        print(f"✗ Error parsing workflows.json: {e}")
    
    # Load individual workflow JSON files (wf_*.json)
    workflow_files = glob.glob(str(config_dir / "wf_*.json"))
    print(f"Found {len(workflow_files)} individual workflow files")
    
    for workflow_file in workflow_files:
        try:
            with open(workflow_file, 'r') as f:
                workflow_data = json.load(f)
                workflow_name = workflow_data.get('workflow_name')
                if workflow_name and workflow_data.get('definition'):
                    workflows[workflow_name] = workflow_data['definition']
                    print(f"✓ Loaded workflow '{workflow_name}' from {Path(workflow_file).name}")
        except Exception as e:
            print(f"✗ Failed to load {workflow_file}: {e}")
    
    print(f"\nTotal workflows to sync: {len(workflows)}")
    
    # Insert/upsert workflows into database
    if not workflows:
        print("⚠ No workflows to sync")
        return False
    
    workflow_rows = []
    for workflow_name, definition in workflows.items():
        workflow_rows.append({
            "workflow_name": workflow_name,
            "definition": definition,
            "is_active": True
        })
    
    try:
        # Delete existing workflows to avoid conflicts
        print("Deleting existing workflow_definitions...")
        supabase.table("workflow_definitions").delete().neq("workflow_name", "something_impossible").execute()
        
        # Insert new workflows
        print("Inserting workflows into database...")
        supabase.table("workflow_definitions").insert(workflow_rows).execute()
        
        print(f"✓ Successfully synced {len(workflow_rows)} workflows to database")
        return True
    except Exception as e:
        print(f"✗ Error syncing workflows to database: {e}")
        return False

if __name__ == "__main__":
    load_dotenv()
    
    print("="*70)
    print("SYNC WORKFLOWS TO DATABASE")
    print("="*70)
    print()
    
    success = sync_workflows_to_db()
    
    print()
    if success:
        print("✅ Workflow sync completed successfully")
        print("Restart the backend to load workflows from database")
    else:
        print("❌ Workflow sync failed")
    
    sys.exit(0 if success else 1)
