from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
from .supabase_client import supabase
from .auth import AuthHandler

class UserManager:
    @staticmethod
    def create_user(user_data: Dict[str, Any], created_by: str = "system") -> Dict[str, Any]:
        """Create a new user in the database"""
        try:
            user_id = str(uuid.uuid4())

            # Hash the password
            password_hash = AuthHandler.hash_password(user_data["password"])

            user_record = {
                "user_id": user_id,
                "username": user_data["username"],
                "password_hash": password_hash,
                "full_name": user_data["full_name"],
                "email": user_data.get("email"),
                "phone_number": user_data.get("phone_number") or user_data.get("phone") or "0000000000",
                "role": user_data["role"],
                "department": user_data.get("department"),
                "hierarchy_country": user_data.get("hierarchy", {}).get("country"),
                "hierarchy_region": user_data.get("hierarchy", {}).get("region"),
                "hierarchy_zone": user_data.get("hierarchy", {}).get("zone"),
                "hierarchy_woreda": user_data.get("hierarchy", {}).get("woreda"),
                "hierarchy_kebele": user_data.get("hierarchy", {}).get("kebele"),
                "is_active": user_data.get("is_active", True),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }

            result = supabase.table('users').insert(user_record).execute()
            created = result.data[0] if result.data else None
            if created:
                try:
                    supabase.table("user_roles").insert(
                        {"user_id": user_id, "role_name": user_data["role"]}
                    ).execute()
                except Exception as ex:
                    # Ignore duplicate errors - user already has this role
                    if "duplicate" not in str(ex).lower() and "unique" not in str(ex).lower():
                        print(f"user_roles insert: {ex}")
            return created
        except Exception as e:
            print(f"Error creating user: {e}")
            return None

    @staticmethod
    def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        """Get user by username"""
        try:
            result = supabase.table('users').select('*').eq('username', username).eq('is_active', True).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting user by username: {e}")
            return None

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by user_id"""
        try:
            result = supabase.table('users').select('*').eq('user_id', user_id).eq('is_active', True).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error getting user by id: {e}")
            return None

    @staticmethod
    def get_all_users() -> List[Dict[str, Any]]:
        """Get all active users"""
        try:
            result = supabase.table('users').select('*').eq('is_active', True).order('created_at', desc=True).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting all users: {e}")
            return []

    @staticmethod
    def get_users_paginated(
        limit: int = 20,
        offset: int = 0,
        role: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get users page and total count, including optional role/department filters."""
        try:
            query = supabase.table('users').select('*')
            query = query.eq('is_active', True)
            if department:
                query = query.eq('department', department)

            if role:
                role_ids = []
                try:
                    roles_res = supabase.table('user_roles').select('user_id').eq('role_name', role).execute()
                    role_ids = [r['user_id'] for r in (roles_res.data or [])]
                except Exception:
                    role_ids = []

                if role_ids:
                    query = query.in_('user_id', role_ids)
                else:
                    return {'users': [], 'total': 0}

            query = query.order('created_at', desc=True).limit(limit).offset(offset)
            result = query.execute()
            users = result.data if result.data else []

            total_count = getattr(result, 'count', None)
            if total_count is None:
                count_query = supabase.table('users').select('user_id', count='exact').eq('is_active', True)
                if department:
                    count_query = count_query.eq('department', department)
                if role and role_ids:
                    count_query = count_query.in_('user_id', role_ids)
                count_result = count_query.execute()
                total_count = getattr(count_result, 'count', len(users))

            return {'users': users, 'total': total_count}
        except Exception as e:
            print(f"Error getting paginated users: {e}")
            return {'users': [], 'total': 0}

    @staticmethod
    def get_roles_for_user_ids(user_ids: List[str]) -> Dict[str, List[str]]:
        """Fetch all extra roles for a set of users in one query."""
        if not user_ids:
            return {}
        try:
            result = supabase.table('user_roles').select('user_id, role_name').in_('user_id', user_ids).execute()
            rows = result.data or []
            role_map: Dict[str, List[str]] = {}
            for row in rows:
                user_id = row.get('user_id')
                role_name = row.get('role_name')
                if not user_id or not role_name:
                    continue
                role_map.setdefault(user_id, []).append(role_name)
            return role_map
        except Exception as e:
            print(f"Error fetching roles for user ids: {e}")
            return {}

    @staticmethod
    def update_user(user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user information"""
        try:
            # Remove password from update_data if it's empty
            if 'password' in update_data and update_data['password']:
                update_data['password_hash'] = AuthHandler.hash_password(update_data['password'])
                del update_data['password']
            elif 'password' in update_data:
                del update_data['password']

            update_data['updated_at'] = datetime.now().isoformat()

            # If role is being updated, also update user_roles table
            if 'role' in update_data:
                new_role = update_data['role']
                # Delete old role from user_roles
                try:
                    supabase.table('user_roles').delete().eq('user_id', user_id).execute()
                except Exception as ex:
                    print(f"Error deleting old user_roles: {ex}")
                # Insert new role into user_roles
                try:
                    supabase.table('user_roles').insert({
                        'user_id': user_id,
                        'role_name': new_role
                    }).execute()
                except Exception as ex:
                    # Ignore duplicate errors
                    if "duplicate" not in str(ex).lower() and "unique" not in str(ex).lower():
                        print(f"Error inserting new user_roles: {ex}")

            result = supabase.table('users').update(update_data).eq('user_id', user_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"Error updating user: {e}")
            return None

    @staticmethod
    def deactivate_user(user_id: str) -> bool:
        """Deactivate a user (soft delete)"""
        try:
            result = supabase.table('users').update({
                'is_active': False,
                'updated_at': datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
            return len(result.data) > 0 if result.data else False
        except Exception as e:
            print(f"Error deactivating user: {e}")
            return False

    @staticmethod
    def activate_user(user_id: str) -> bool:
        """Activate a user"""
        try:
            result = supabase.table('users').update({
                'is_active': True,
                'updated_at': datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
            return len(result.data) > 0 if result.data else False
        except Exception as e:
            print(f"Error activating user: {e}")
            return False

    @staticmethod
    def update_last_login(user_id: str) -> bool:
        """Update user's last login timestamp"""
        try:
            result = supabase.table('users').update({
                'last_login': datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
            return len(result.data) > 0 if result.data else False
        except Exception as e:
            print(f"Error updating last login: {e}")
            return False

    @staticmethod
    def get_users_by_role(role: str) -> List[Dict[str, Any]]:
        """Get all users with a specific role"""
        try:
            result = supabase.table('users').select('*').eq('role', role).eq('is_active', True).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting users by role: {e}")
            return []

    @staticmethod
    def get_users_by_department(department: str) -> List[Dict[str, Any]]:
        """Get all users in a specific department"""
        try:
            result = supabase.table('users').select('*').eq('department', department).eq('is_active', True).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"Error getting users by department: {e}")
            return []

user_manager = UserManager()