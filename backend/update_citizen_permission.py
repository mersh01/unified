import sys
from pathlib import Path
import json

# Add app directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / "app"))

# Import dotenv first
import dotenv
dotenv_path = Path(__file__).parent / ".env"
dotenv.load_dotenv(dotenv_path)

from supabase_client import supabase

def update_citizen_permission():
    """Add create_application permission to citizen role in database"""
    
    # Get current citizen role from database
    try:
        res = supabase.table("roles").select("*").eq("role_name", "citizen").execute()
        if not res.data:
            print("❌ Citizen role not found in database")
            return
        
        citizen_role = res.data[0]
        current_permissions = citizen_role.get("permissions", [])
        
        # Handle if permissions is a string
        if isinstance(current_permissions, str):
            current_permissions = json.loads(current_permissions)
        
        print(f"Current citizen permissions: {current_permissions}")
        
        # Add create_application if not already present
        if "create_application" not in current_permissions:
            current_permissions.append("create_application")
            print(f"Adding create_application permission")
        else:
            print(f"create_application already exists")
            return
        
        # Update the role in database
        supabase.table("roles").update({
            "permissions": json.dumps(current_permissions)
        }).eq("role_name", "citizen").execute()
        
        print("✅ Updated citizen role in database with create_application permission")
        
    except Exception as e:
        print(f"❌ Error updating citizen role: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("====================================")
    print("  UPDATE CITIZEN PERMISSION IN DB")
    print("====================================")
    update_citizen_permission()
    print("====================================")
    print("  ✅ COMPLETED")
    print("====================================")
