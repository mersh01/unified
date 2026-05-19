#!/usr/bin/env python3
"""
Comprehensive user seeding script for the document management system.
Seeds users from config/users.json with proper role assignments and hierarchy.
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, Any, List
import bcrypt

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.user_manager import user_manager
from app.role_manager import role_manager
from app.config_seed import seed_if_empty, ensure_workflow_roles_exist

def load_config_file(filename: str) -> Dict[str, Any]:
    """Load a JSON config file"""
    config_dir = Path(__file__).parent / "config"
    config_path = config_dir / filename

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {filename}: {e}")
        return {}

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_users_from_config():
    """Seed users from config/users.json"""
    print("Seeding users from config/users.json...")

    users_config = load_config_file("users.json")
    if not users_config or "users" not in users_config:
        print("No users config found")
        return 0

    seeded_count = 0
    skipped_count = 0
    phone_counter = 1000000000  # Start with a unique phone number

    for username, user_data in users_config["users"].items():
        # Check if user already exists
        existing_user = user_manager.get_user_by_username(username)
        if existing_user:
            print(f"✓ User {username} already exists, skipping")
            skipped_count += 1
            continue

        # Generate unique phone number
        phone_number = user_data.get("phone") or user_data.get("phone_number") or str(phone_counter)
        phone_counter += 1

        # Prepare user data for creation
        user_dict = {
            "username": username,
            "full_name": user_data.get("name", username),
            "email": user_data.get("email"),
            "phone_number": phone_number,
            "role": user_data.get("role", "viewer"),
            "department": user_data.get("department"),
            "hierarchy": user_data.get("hierarchy", {}),
            "password": user_data.get("password", "default123"),
            "is_active": True
        }

        # Create user in database
        created_user = user_manager.create_user(user_dict, "seed_script")
        if created_user:
            seeded_count += 1
            role_name = user_data.get("role", "viewer")
            department = user_data.get("department", "unknown")
            hierarchy_level = user_data.get("hierarchy", {}).get("level", "unknown")
            print(f"✓ Seeded user: {username} ({role_name} - {department} - {hierarchy_level})")
        else:
            print(f"✗ Failed to seed user: {username}")

    print(f"\nUser seeding completed:")
    print(f"  - Seeded: {seeded_count} users")
    print(f"  - Skipped: {skipped_count} existing users")
    return seeded_count

def seed_additional_test_users():
    """Seed additional test users for comprehensive testing"""
    print("\nSeeding additional test users...")

    test_users = [
        {
            "username": "test_admin_oromia",
            "password": "admin123",
            "name": "Test Admin Oromia",
            "role": "super_admin",
            "department": "all",
            "hierarchy": {
                "country": "ETH",
                "region": "OROMIA",
                "zone": None,
                "woreda": None,
                "kebele": None,
                "level": "region"
            },
            "can_see_subordinate_hierarchies": True
        },
        {
            "username": "test_verifier_sinana",
            "password": "test123",
            "name": "Test Verifier Sinana",
            "role": "verification_officer",
            "department": "verification",
            "hierarchy": {
                "country": "ETH",
                "region": "OROMIA",
                "zone": "BALE",
                "woreda": "SINANA",
                "kebele": None,
                "level": "woreda"
            },
            "can_see_subordinate_hierarchies": True
        },
        {
            "username": "test_doc_kebele01",
            "password": "test123",
            "name": "Test Document Officer Kebele 01",
            "role": "document_verifier",
            "department": "document_verification",
            "hierarchy": {
                "country": "ETH",
                "region": "OROMIA",
                "zone": "BALE",
                "woreda": "SINANA",
                "kebele": "KEBELE_01",
                "level": "kebele"
            },
            "can_see_subordinate_hierarchies": False
        },
        {
            "username": "test_payment_kebele02",
            "password": "test123",
            "name": "Test Payment Officer Kebele 02",
            "role": "payment_officer",
            "department": "payment",
            "hierarchy": {
                "country": "ETH",
                "region": "OROMIA",
                "zone": "BALE",
                "woreda": "SINANA",
                "kebele": "KEBELE_02",
                "level": "kebele"
            },
            "can_see_subordinate_hierarchies": False
        }
    ]

    seeded_count = 0
    phone_counter = 2000000000  # Different range for test users

    for user_data in test_users:
        username = user_data["username"]

        # Check if user already exists
        existing_user = user_manager.get_user_by_username(username)
        if existing_user:
            print(f"✓ Test user {username} already exists, skipping")
            continue

        # Generate unique phone number
        phone_number = str(phone_counter)
        phone_counter += 1

        # Prepare user data for creation (ensure full_name is set)
        user_dict = {
            "username": user_data["username"],
            "full_name": user_data.get("name", user_data["username"]),
            "email": user_data.get("email"),
            "phone_number": phone_number,
            "role": user_data.get("role", "viewer"),
            "department": user_data.get("department"),
            "hierarchy": user_data.get("hierarchy", {}),
            "password": user_data.get("password", "default123"),
            "is_active": True
        }

        # Create user
        created_user = user_manager.create_user(user_dict, "seed_script")
        if created_user:
            seeded_count += 1
            role_name = user_data.get("role")
            hierarchy_level = user_data.get("hierarchy", {}).get("level", "unknown")
            print(f"✓ Seeded test user: {username} ({role_name} - {hierarchy_level})")
        else:
            print(f"✗ Failed to seed test user: {username}")

    print(f"\nAdditional test users seeding completed: {seeded_count} users seeded")
    return seeded_count

def display_user_summary():
    """Display a summary of all seeded users"""
    print("\n" + "="*80)
    print("USER SEEDING SUMMARY")
    print("="*80)

    all_users = user_manager.get_all_users()
    if not all_users:
        print("No users found in database")
        return

    # Group users by role
    users_by_role = {}
    users_by_department = {}
    users_by_hierarchy_level = {}

    for user in all_users:
        role = user.get("role", "unknown")
        department = user.get("department", "unknown")
        hierarchy_level = user.get("hierarchy_level", "unknown")

        if role not in users_by_role:
            users_by_role[role] = []
        users_by_role[role].append(user)

        if department not in users_by_department:
            users_by_department[department] = []
        users_by_department[department].append(user)

        if hierarchy_level not in users_by_hierarchy_level:
            users_by_hierarchy_level[hierarchy_level] = []
        users_by_hierarchy_level[hierarchy_level].append(user)

    print(f"\nTotal Users: {len(all_users)}")
    print(f"\nUsers by Role:")
    for role, users in sorted(users_by_role.items()):
        print(f"  {role}: {len(users)} users")

    print(f"\nUsers by Department:")
    for dept, users in sorted(users_by_department.items()):
        print(f"  {dept}: {len(users)} users")

    print(f"\nUsers by Hierarchy Level:")
    for level, users in sorted(users_by_hierarchy_level.items()):
        print(f"  {level}: {len(users)} users")

    print(f"\nSample Users:")
    for i, user in enumerate(all_users[:10]):  # Show first 10 users
        username = user.get("username")
        role = user.get("role")
        department = user.get("department")
        level = user.get("hierarchy_level")
        print(f"  {i+1}. {username} ({role} - {department} - {level})")

    if len(all_users) > 10:
        print(f"  ... and {len(all_users) - 10} more users")

def main():
    """Main seeding function"""
    print("Starting comprehensive user seeding for Document Management System...")
    print("="*80)

    try:
        # Ensure config is seeded first
        print("1. Ensuring configuration is seeded...")
        if seed_if_empty():
            print("✓ Configuration seeded")
        else:
            print("✓ Configuration already exists")

        # Ensure workflow roles exist
        ensure_workflow_roles_exist()

        # Reload managers to get latest config
        role_manager.reload()

        # Seed users from config
        print("\n2. Seeding users from configuration files...")
        config_seeded = seed_users_from_config()

        # Seed additional test users
        print("\n3. Seeding additional test users...")
        test_seeded = seed_additional_test_users()

        # Display summary
        display_user_summary()

        total_seeded = config_seeded + test_seeded
        print(f"\n{'='*80}")
        print(f"SUCCESS: Seeded {total_seeded} users total")
        print("The system now has users across different departments and hierarchy levels.")
        print("Users can log in with their username and password to test different roles.")
        print(f"{'='*80}")

    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()