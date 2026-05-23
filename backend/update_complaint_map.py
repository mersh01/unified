"""
Script to update complaint_submission service configuration in database to include map selection.
This script updates the service_definitions table with the new complaint_map step from documents.json.
"""
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

def update_complaint_service_with_map():
    """Update complaint_submission service in database to include map selection."""
    try:
        from app.supabase_client import supabase
    except Exception as e:
        print(f"Cannot import supabase: {e}")
        print("Make sure you're running this from the backend directory")
        return False

    # Load the updated documents.json
    config_path = Path(__file__).parent / "config" / "documents.json"
    with open(config_path, 'r', encoding='utf-8') as f:
        documents = json.load(f)

    # Get the complaint_submission configuration
    complaint_config = documents.get("services", {}).get("complaint_submission")
    if not complaint_config:
        print("complaint_submission not found in documents.json")
        return False

    # Check if the complaint_map step exists
    has_map_step = False
    for step in complaint_config.get("steps", []):
        if step.get("id") == "complaint_map":
            has_map_step = True
            print(f"✓ Found complaint_map step in documents.json")
            break

    if not has_map_step:
        print("✗ complaint_map step not found in documents.json")
        return False

    # Update the database
    try:
        from datetime import datetime
        now = datetime.now().isoformat()

        row = {
            "service_id": "complaint_submission",
            "service_kind": "service",
            "config": complaint_config,
            "is_active": True,
            "updated_at": now,
        }

        supabase.table("service_definitions").upsert(row, on_conflict="service_id").execute()
        print(f"✓ Successfully updated complaint_submission in database")
        print(f"  - Added complaint_map step with map field type")
        print(f"  - Total steps: {len(complaint_config.get('steps', []))}")
        
        # Reload config engine to apply changes
        try:
            from app.config_engine import config_engine
            config_engine.reload()
            print(f"✓ Config engine reloaded successfully")
        except Exception as e:
            print(f"⚠ Could not reload config engine: {e}")

        return True
    except Exception as e:
        print(f"✗ Failed to update database: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Updating complaint_submission service configuration...")
    print("=" * 60)
    success = update_complaint_service_with_map()
    print("=" * 60)
    if success:
        print("✓ Update completed successfully")
    else:
        print("✗ Update failed")
        print("\nAlternative: Run 'python force_seed.py' to reload all configurations from JSON files")
