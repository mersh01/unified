from app.supabase_client import supabase
from app.auth import AuthHandler
from datetime import datetime
import uuid

def create_user(username, role, full_name):
    # Check if user already exists
    res = supabase.table('users').select('*').eq('username', username).execute()
    if res.data:
        print(f"User {username} already exists.")
        return

    user_id = str(uuid.uuid4())
    password_hash = AuthHandler.hash_password("password123")
    now = datetime.utcnow().isoformat()

    new_user = {
        "user_id": user_id,
        "username": username,
        "full_name": full_name,
        "phone_number": f"0000000{str(hash(username))[-3:]}",
        "role": role,
        "department": "complaints",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "password_hash": password_hash,
        "hierarchy_country": "ETH",
        "hierarchy_region": "OROMIA",
        "hierarchy_zone": "BALE",
        "hierarchy_woreda": "SINANA",
        "hierarchy_kebele": "KEBELE_01"
    }

    try:
        supabase.table("users").insert(new_user).execute()
        # Insert into user_roles as well
        supabase.table("user_roles").insert({
            "user_id": user_id,
            "role_name": role
        }).execute()
        print(f"Successfully created user: {username} (Role: {role})")
    except Exception as e:
        print(f"Failed to create user {username}: {e}")

if __name__ == "__main__":
    create_user("test_gro", "gro", "Grievance Redress Officer")
    create_user("test_lme", "lme", "Local Management Entity")
