#!/usr/bin/env python
"""Seed the admin user into Supabase database"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

print(f"Connecting to Supabase: {SUPABASE_URL}")
print(f"Using service key: {SUPABASE_SERVICE_KEY[:50]}...")

# Create client with service key (bypasses RLS)
client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Admin user data with bcrypt hash for password "admin123"
admin_user = {
    "user_id": "ADMIN_001",
    "username": "admin",
    "email": "admin@system.local",
    "phone_number": "0000000000",
    "full_name": "System Administrator",
    "role": "super_admin",
    "department": "IT",
    "password_hash": "$2b$12$CynCF4fpVC.5XQO1r6u0pObUPo9eKwr8i2031Qi5v6MFwF8L4KghC",
    "is_active": True,
}

try:
    # First, check if admin already exists
    print("\n[1/3] Checking if admin user already exists...")
    response = client.table("users").select("*").eq("username", "admin").execute()
    
    if response.data:
        print(f"✓ Admin user already exists: {response.data[0]}")
        sys.exit(0)
    
    print("✗ Admin user not found, will create...")
    
    # Insert admin user
    print("\n[2/3] Inserting admin user...")
    response = client.table("users").insert(admin_user).execute()
    print(f"✓ Admin user created successfully!")
    print(f"   User ID: {response.data[0]['user_id']}")
    print(f"   Username: {response.data[0]['username']}")
    print(f"   Role: {response.data[0]['role']}")
    
    # Verify insertion
    print("\n[3/3] Verifying insertion...")
    response = client.table("users").select("*").eq("username", "admin").execute()
    if response.data:
        print(f"✓ Verification passed! Admin user is in database:")
        print(f"   {response.data[0]}")
        print("\n✅ SUCCESS! You can now login with:")
        print("   Username: admin")
        print("   Password: admin123")
    else:
        print("✗ Verification failed - user not found after insert")
        sys.exit(1)

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
