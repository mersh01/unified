#!/usr/bin/env python3
"""
Migration script to move users and roles from config files to Supabase database.
Run this script once to migrate existing data.
"""

import json
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.user_manager import user_manager
from app.role_manager import role_manager
from app.config_seed import seed_if_empty

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

def migrate_roles():
    """Seed roles and dynamic config via shared seed_if_empty (idempotent when data exists)."""
    print("Migrating roles and config via seed_if_empty()...")
    if seed_if_empty():
        role_manager.reload()
        print("Seed completed (was empty).")
    else:
        print("Config tables already populated; run admin APIs or PUT /api/admin/config/settings/* to update.")

def migrate_users():
    """Migrate users from config to database"""
    print("Migrating users...")

    users_config = load_config_file("users.json")
    if not users_config or "users" not in users_config:
        print("No users config found")
        return

    migrated_count = 0
    for username, user_data in users_config["users"].items():
        # Check if user already exists
        existing_user = user_manager.get_user_by_username(username)
        if existing_user:
            print(f"User {username} already exists, skipping")
            continue

        # Create user in database
        user_dict = {
            "username": username,
            "full_name": user_data.get("name", username),
            "email": user_data.get("email"),
            "phone_number": user_data.get("phone") or user_data.get("phone_number"),
            "role": user_data.get("role", "viewer"),
            "department": user_data.get("department"),
            "hierarchy": user_data.get("hierarchy", {}),
            "can_see_subordinate_hierarchies": user_data.get("can_see_subordinate_hierarchies", True),
            "password": user_data.get("password", "default123"),  # Use existing password or default
            "is_active": True
        }

        created_user = user_manager.create_user(user_dict, "migration_script")
        if created_user:
            migrated_count += 1
            print(f"Migrated user: {username}")
        else:
            print(f"Failed to migrate user: {username}")

    print(f"Users migration completed: {migrated_count} users migrated")

def main():
    """Main migration function"""
    print("Starting migration from config files to Supabase database...")

    try:
        # Migrate roles first (needed for user role references)
        migrate_roles()

        # Then migrate users
        migrate_users()

        print("Migration completed successfully!")
        print("\nNote: You can now remove the config/users.json and config/roles.json files")
        print("as the data is now stored in the database.")

    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()