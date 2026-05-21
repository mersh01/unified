from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import jwt
import hashlib
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .role_manager import role_manager

# Secret key for JWT (in production, use environment variable)
SECRET_KEY = "your-secret-key-change-in-production"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# In-memory OTP storage (in production, use Redis or database)
otp_storage = {}

# Role-based permissions
ROLE_PERMISSIONS = {
    "super_admin": [
        "view_all_applications", "update_status", "delete_applications",
        "view_admin_dashboard", "manage_users", "view_all_departments",
        "manage_roles", "export_data", "generate_reports"
    ],
    "verification_officer": [
        "view_department_applications", "verify_applications", "reject_applications",
        "request_additional_info", "add_comments"
    ],
    "document_verifier": [
        "view_department_applications", "verify_documents", "reject_documents",
        "request_additional_documents", "add_comments"
    ],
    "payment_officer": [
        "view_department_applications", "process_payments", "view_payment_reports",
        "refund_payments", "add_comments"
    ],
    "certificate_issuer": [
        "view_department_applications", "issue_certificates", "generate_tracking_ids",
        "dispatch_certificates", "add_comments"
    ],
    "quality_auditor": [
        "view_department_applications", "audit_applications", "flag_issues",
        "view_reports", "add_comments"
    ],
    "viewer": [
        "view_department_applications_readonly", "export_data"
    ]
}

import bcrypt

# ... existing code ...

class AuthHandler:
    security = HTTPBearer(auto_error=False)

    @staticmethod
    def _fetch_user_role_names(user_id: str) -> List[str]:
        try:
            from .supabase_client import supabase

            res = supabase.table("user_roles").select("role_name").eq("user_id", user_id).execute()
            return [r["role_name"] for r in (res.data or [])]
        except Exception:
            return []

    @staticmethod
    def _order_roles(primary: Optional[str], extra: List[str]) -> List[str]:
        out: List[str] = []
        if primary:
            out.append(primary)
        for r in extra:
            if r and r not in out:
                out.append(r)
        return out

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    @staticmethod
    def generate_otp(phone_number: str) -> str:
        """Generate and store OTP for phone number"""
        otp = "1234"
        otp_storage[phone_number] = {
            "otp": otp,
            "expires_at": datetime.now() + timedelta(minutes=5),
            "attempts": 0
        }
        print(f"[SMS] To {phone_number}: Your OTP is {otp}")
        return otp
    
    @staticmethod
    def verify_otp(phone_number: str, otp: str) -> bool:
        """Verify OTP for phone number"""
        if phone_number not in otp_storage:
            return False
        
        otp_data = otp_storage[phone_number]
        
        if datetime.now() > otp_data["expires_at"]:
            del otp_storage[phone_number]
            return False
        
        if otp_data["attempts"] >= 3:
            del otp_storage[phone_number]
            return False
        
        if otp_data["otp"] == otp:
            del otp_storage[phone_number]
            return True
        
        otp_data["attempts"] += 1
        return False
    
    @staticmethod
    def create_user_token(user_id: str, phone_number: str) -> str:
        """Create JWT token for user"""
        payload = {
            "user_id": user_id,
            "phone_number": phone_number,
            "role": "citizen",
            "type": "user",
            "exp": datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def create_admin_token_from_db(user_data: Dict[str, Any]) -> str:
        """Create JWT token for admin user from database"""
        roles = user_data.get("roles") or [user_data["role"]]
        payload = {
            "user_id": user_data["user_id"],
            "username": user_data.get("username"),
            "role": user_data["role"],
            "roles": roles,
            "department": user_data.get("department"),
            "hierarchy": {
                "country": user_data.get("hierarchy_country"),
                "region": user_data.get("hierarchy_region"),
                "zone": user_data.get("hierarchy_zone"),
                "woreda": user_data.get("hierarchy_woreda"),
                "kebele": user_data.get("hierarchy_kebele")
            },
            "type": "admin",
            "exp": datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def verify_admin_credentials(username: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify admin credentials against database"""
        try:
            from .user_manager import user_manager

            # Get user from database
            user = user_manager.get_user_by_username(username)

            if user and user.get('password_hash'):
                if AuthHandler.verify_password(password, user['password_hash']):
                    # Update last login
                    user_manager.update_last_login(user['user_id'])

                    extra_roles = AuthHandler._fetch_user_role_names(user["user_id"])
                    ordered_roles = AuthHandler._order_roles(user["role"], extra_roles)
                    return {
                        "user_id": user["user_id"],
                        "username": user.get("username"),
                        "role": user["role"],
                        "roles": ordered_roles,
                        "department": user.get("department"),
                        "name": user["full_name"],
                        "hierarchy": {
                            "country": user.get("hierarchy_country"),
                            "region": user.get("hierarchy_region"),
                            "zone": user.get("hierarchy_zone"),
                            "woreda": user.get("hierarchy_woreda"),
                            "kebele": user.get("hierarchy_kebele"),
                            "level": user.get("hierarchy_level")
                        }
                    }

            return None

        except Exception as e:
            print(f"Error verifying admin credentials: {e}")
            return None
    
    @staticmethod
    def create_admin_token(admin_data: Dict[str, Any]) -> str:
        """Create JWT token for admin"""
        hierarchy = admin_data.get("hierarchy", {
            "country": "IND",
            "region": None,
            "zone": None,
            "level": "country"
        })
        payload = {
            "username": admin_data["username"],
            "role": admin_data["role"],
            "department": admin_data["department"],
            "hierarchy": hierarchy,
            "type": "admin",
            "exp": datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    @staticmethod
    async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Get current user from token (optional)"""
        if not credentials:
            return None
        
        token = credentials.credentials
        payload = AuthHandler.verify_token(token)
        
        if payload.get("type") == "user":
            return {
                "user_id": payload.get("user_id"),
                "phone_number": payload.get("phone_number"),
                "role": "citizen",
                "type": "user",
                "is_authenticated": True
            }
        else:
            roles = payload.get("roles") or ([payload.get("role")] if payload.get("role") else [])
            return {
                "user_id": payload.get("user_id"),
                "username": payload.get("username"),
                "role": payload.get("role"),
                "roles": roles,
                "department": payload.get("department"),
                "hierarchy": payload.get("hierarchy", {
                    "country": "IND",
                    "region": None,
                    "zone": None,
                    "level": "country"
                }),
                "type": "admin",
                "is_authenticated": True
            }
    
    @staticmethod
    async def get_current_user_required(credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Get current user from token (required)"""
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        token = credentials.credentials
        payload = AuthHandler.verify_token(token)
        
        if payload.get("type") == "user":
            return {
                "user_id": payload.get("user_id"),
                "phone_number": payload.get("phone_number"),
                "role": "citizen",
                "type": "user",
                "is_authenticated": True
            }
        else:
            user_id = payload.get("user_id")
            if user_id:
                try:
                    from .supabase_client import supabase
                    result = supabase.table('users').select('*').eq('user_id', user_id).execute()
                    user = result.data[0] if result.data else None
                    if user:
                        extra = AuthHandler._fetch_user_role_names(user_id)
                        roles = AuthHandler._order_roles(user.get("role"), extra)
                        return {
                            "user_id": user["user_id"],
                            "username": user.get("username"),
                            "role": user["role"],
                            "roles": roles,
                            "department": user.get("department"),
                            "name": user.get("full_name"),
                            "hierarchy": {
                                "country": user.get("hierarchy_country"),
                                "region": user.get("hierarchy_region"),
                                "zone": user.get("hierarchy_zone"),
                                "woreda": user.get("hierarchy_woreda"),
                                "kebele": user.get("hierarchy_kebele")
                            },
                            "type": "admin",
                            "is_authenticated": True
                        }
                except Exception as e:
                    print(f"Error fetching admin user from database: {e}")

            raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    
    @staticmethod
    def check_permission(user: Dict[str, Any], required_permission: str) -> bool:
        """Check if user has required permission"""
        if not user:
            return False
        
        if user["type"] == "user":
            return required_permission in ["view_own_applications", "create_application"]

        role_list = user.get("roles") or [user.get("role")]
        for role in role_list:
            if not role:
                continue
            role_config = role_manager.get_role_config(role)
            if role_config is not None:
                permissions = role_config.get("permissions", [])
                if "*" in permissions:
                    return True
                if required_permission in permissions:
                    return True
            else:
                permissions = ROLE_PERMISSIONS.get(role, [])
                if required_permission in permissions:
                    return True
        return False
    
    @staticmethod
    def get_allowed_actions_for_state(user: Dict[str, Any], current_state: str) -> List[str]:
        """Get allowed actions for a user in a specific state using permission-based access control"""
        if user["type"] == "user":
            return []

        role_list = user.get("roles") or [user.get("role")]
        merged: List[str] = []
        for role in role_list:
            if not role:
                continue
            role_config = role_manager.get_role_config(role)
            if role_config is not None:
                merged.extend(role_manager.get_available_actions_for_user(role, current_state))

        # Fallback permission-based workflow mapping
        workflow_permissions = {
            "SUBMITTED": {
                "allowed_permissions": ["verify_applications", "assign_complaints", "reject_complaints"],
                "allowed_actions": ["PROCESS", "REJECT", "ASSIGN_TO_LME"]
            },
            "DOCUMENT_CHECK": {
                "allowed_permissions": ["verify_applications"],
                "allowed_actions": ["APPROVE", "REJECT", "REQUEST_DOCUMENTS"]
            },
            "VERIFICATION": {
                "allowed_permissions": ["verify_applications"],
                "allowed_actions": ["APPROVE", "REQUEST_INFO", "REJECT", "ESCALATE"]
            },
            "SENIOR_VERIFICATION": {
                "allowed_permissions": ["verify_applications", "override_verification"],
                "allowed_actions": ["APPROVE", "REJECT", "RETURN_TO_OFFICER"]
            },
            "DOCUMENT_VERIFICATION": {
                "allowed_permissions": ["verify_documents"],
                "allowed_actions": ["APPROVE", "REJECT", "REQUEST_ADDITIONAL_DOCS", "FLAG_FRAUD"]
            },
            "SENIOR_DOCUMENT_VERIFICATION": {
                "allowed_permissions": ["verify_documents", "override_document_verification"],
                "allowed_actions": ["APPROVE", "REJECT", "RETURN_TO_VERIFIER"]
            },
            "PAYMENT_PENDING": {
                "allowed_permissions": ["process_payments", "make_payment"],
                "allowed_actions": ["MAKE_PAYMENT", "CANCEL", "HOLD_PAYMENT"]
            },
            "PAYMENT_APPROVAL": {
                "allowed_permissions": ["process_payments", "approve_refunds"],
                "allowed_actions": ["APPROVE_PAYMENT", "REJECT_PAYMENT"]
            },
            "PAYMENT_COMPLETED": {
                "allowed_permissions": ["issue_certificates"],
                "allowed_actions": ["GENERATE_CERTIFICATE"]
            },
            "CERTIFICATE_GENERATED": {
                "allowed_permissions": ["issue_certificates", "dispatch_certificates"],
                "allowed_actions": ["DISPATCH", "EMAIL"]
            },
            "QUALITY_CHECK": {
                "allowed_permissions": ["audit_applications", "flag_issues"],
                "allowed_actions": ["APPROVE", "FLAG_ISSUES", "RETURN_FOR_CORRECTION"]
            },
            "COMPLETED": {
                "allowed_permissions": ["audit_applications"],
                "allowed_actions": ["AUDIT", "APPROVE", "FLAG_ISSUES"]
            },
            "REJECTED": {
                "allowed_permissions": ["appeal_decision"],
                "allowed_actions": ["APPEAL"]
            }
        }
        
        state_config = workflow_permissions.get(current_state, {})
        state_allowed_permissions = state_config.get("allowed_permissions", [])
        state_allowed_actions = state_config.get("allowed_actions", [])

        if state_allowed_permissions:
            # Aggregate user permissions from all roles
            user_permissions = role_manager.get_permissions_for_roles(role_list)
            if set(user_permissions) & set(state_allowed_permissions):
                merged.extend(state_allowed_actions)

        return list(dict.fromkeys(merged))
    @staticmethod
    def filter_applications_by_department(user: Dict[str, Any], applications: list) -> list:
        """Filter applications based on user's department"""
        if not user:
            return []
        
        if user["type"] == "user":
            return [app for app in applications if app.get('user_id') == user.get('user_id')]
        
        role_list = user.get("roles") or [user.get("role")]
        department = user.get("department")

        if "super_admin" in role_list or department == "all":
            return applications
        
        allowed_states = role_manager.get_department_states(department)
        if "ALL_STATES" in allowed_states:
            return applications
        
        return [app for app in applications if app.get('current_state') in allowed_states]