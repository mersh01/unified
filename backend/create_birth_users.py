import uuid
from datetime import datetime
from app.supabase_client import supabase
from app.auth import AuthHandler

users = [
    {
        "username": "birth_verifier",
        "full_name": "Birth Cert Verifier",
        "role": "verification_officer",
        "department": "verification",
        "phone_number": "0987654322"
    },
    {
        "username": "birth_document",
        "full_name": "Birth Cert Document Verifier",
        "role": "document_verifier",
        "department": "document_verification",
        "phone_number": "0987654323"
    }
]

for u in users:
    user_id = str(uuid.uuid4())
    pw_hash = AuthHandler.hash_password("password123")
    user_row = {
        "user_id": user_id,
        "username": u["username"],
        "full_name": u["full_name"],
        "password_hash": pw_hash,
        "role": u["role"],
        "department": u["department"],
        "phone_number": u["phone_number"],
        "is_active": True,
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }
    # Check if exists
    res = supabase.table("users").select("*").eq("username", u["username"]).execute()
    if not res.data:
        supabase.table("users").insert(user_row).execute()
        print(f"Created {u['username']}")
    else:
        print(f"{u['username']} already exists")
