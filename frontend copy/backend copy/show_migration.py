#!/usr/bin/env python3
"""
Manual migration script to show what users and roles need to be migrated.
This script reads the config files and prints the data that should be inserted.
"""

import json
import sys
from pathlib import Path

def load_config_file(filename):
    """Load a JSON config file"""
    config_dir = Path(__file__).parent / "config"
    config_path = config_dir / filename

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {filename}: {e}")
        return None

def show_migration_data():
    """Show what data needs to be migrated"""
    print("=== USERS TO MIGRATE ===")

    users_config = load_config_file("users.json")
    if users_config and "users" in users_config:
        for username, user_data in users_config["users"].items():
            print(f"\nUser: {username}")
            print(f"  Full Name: {user_data.get('name', username)}")
            print(f"  Role: {user_data.get('role', 'viewer')}")
            print(f"  Department: {user_data.get('department', 'view_only')}")
            print(f"  Password: {user_data.get('password', 'default123')}")
            hierarchy = user_data.get('hierarchy', {})
            print(f"  Hierarchy: {hierarchy}")
            print(f"  Can see subordinate hierarchies: {user_data.get('can_see_subordinate_hierarchies', True)}")

    print("\n=== ROLES TO MIGRATE ===")

    roles_config = load_config_file("roles.json")
    if roles_config and "roles" in roles_config:
        for role_id, role_data in roles_config["roles"].items():
            print(f"\nRole: {role_id}")
            print(f"  Name: {role_data.get('name', role_id)}")
            print(f"  Description: {role_data.get('description', '')}")
            print(f"  Permissions: {role_data.get('permissions', [])}")
            print(f"  Departments: {role_data.get('departments', [])}")
            print(f"  Can assign roles: {role_data.get('can_assign_roles', False)}")
            print(f"  Priority: {role_data.get('priority', 0)}")

    print("\n=== NEXT STEPS ===")
    print("1. Set up Supabase cloud instance at https://supabase.com")
    print("2. Create a new project")
    print("3. Get your project URL and anon key")
    print("4. Update backend/.env with SUPABASE_URL and SUPABASE_ANON_KEY")
    print("5. Run the supabase_init.sql in your Supabase SQL editor")
    print("6. Then run the full migration script: python migrate_to_db.py")

if __name__ == "__main__":
    show_migration_data()