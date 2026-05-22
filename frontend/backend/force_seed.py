import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.supabase_client import supabase
from app.config_seed import seed_if_empty

print("Deleting existing configuration rows...")
try:
    # Delete all rows from config tables so seed_if_empty runs
    supabase.table("service_definitions").delete().neq("service_id", "something_impossible").execute()
    supabase.table("workflow_definitions").delete().neq("workflow_name", "something_impossible").execute()
    supabase.table("app_settings").delete().neq("key", "something_impossible").execute()
    print("Deleted successfully. Now running seed_if_empty()...")
    
    seed_if_empty()
    print("Force seed completed successfully.")
except Exception as e:
    print(f"Error: {e}")
