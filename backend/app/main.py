from fastapi import FastAPI, HTTPException, Depends, status, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import json
from pathlib import Path
from fastapi import Request
from fastapi.responses import Response
import os
from minio import Minio
from minio.error import S3Error
# Import our modules
from .config_engine import ConfigEngine
from .workflow_engine import WorkflowEngine
from .notification_service import NotificationService
from .auth import AuthHandler
from .hierarchy_manager import hierarchy_manager
from .role_manager import role_manager
from .supabase_client import create_application as db_create_application, get_application as db_get_application, update_application, get_all_applications, get_applications_by_user, get_applications_by_department
from .db_init import initialize_db
from .config_seed import seed_if_empty, ensure_workflow_roles_exist, ensure_admin_user_roles_link

app = FastAPI(title="Document Management System", version="2.0.0")

# Initialize MinIO client
minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
minio_client = Minio(
    minio_endpoint,
    access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
    secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
    secure=False  # Set to True for HTTPS
)
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "documents")
MINIO_AVAILABLE = False

# Only attempt MinIO connection if endpoint is explicitly configured
if os.getenv("MINIO_ENDPOINT"):
    try:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
        MINIO_AVAILABLE = True
        print("MinIO connected successfully")
    except Exception as e:
        print(f"MinIO not available, using local filesystem fallback: {e}")
else:
    print("MINIO_ENDPOINT not set, using local filesystem for uploads")

# Local filesystem fallback directory (use /tmp for serverless environments)
import tempfile
LOCAL_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), 'profile_pictures')
try:
    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create local upload dir: {e}")


def _roles_list(user: Dict[str, Any]) -> List[str]:
    if user.get("roles"):
        return list(user["roles"])
    r = user.get("role")
    return [r] if r else []


def user_has_any_role(user: Dict[str, Any], *names: str) -> bool:
    return bool(set(_roles_list(user)) & set(names))


def _load_available_locales() -> List[Dict[str, Any]]:
    try:
        from .supabase_client import supabase
        res = supabase.table("localization_definitions").select("locale, display_name").order("locale").execute()
        return res.data or []
    except Exception:
        return []


def _load_localization(locale: str) -> Dict[str, Any]:
    try:
        from .supabase_client import supabase
        res = supabase.table("localization_definitions").select("translations, display_name").eq("locale", locale).limit(1).execute()
        if res.data:
            return res.data[0].get("translations") or {}
        return {}
    except Exception:
        return {}


def _load_localization_entry(locale: str) -> Dict[str, Any]:
    try:
        from .supabase_client import supabase
        res = supabase.table("localization_definitions").select("locale, display_name, translations").eq("locale", locale).limit(1).execute()
        if res.data:
            return res.data[0]
        return {}
    except Exception:
        return {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://unified-anybeuhd9-mersh01s-projects.vercel.app",
        "https://unified-git-main-mersh01s-projects.vercel.app",
        "https://unified-psi.vercel.app",
        "https://unified-lts3ld4xg-mersh01s-projects.vercel.app",
    ],
    # Same-machine browser using LAN IP (Vite --host) and Vercel domains
    allow_origin_regex=r"https://.*\.vercel\.app|http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event to initialize database schema
@app.on_event("startup")
def startup_event():
    """Initialize database schema on startup"""
    print("Starting Document Management System...")
    if not initialize_db():
        print("⚠ Warning: Database schema may not be initialized. The application may not work correctly.")
    try:
        if seed_if_empty():
            print("✓ Seeded dynamic configuration from JSON files")
        ensure_workflow_roles_exist()
        ensure_admin_user_roles_link()
        config_engine.reload()
        workflow_engine.reload()
        role_manager.reload()
    except Exception as exc:
        print(f"⚠ Config reload/seed skipped: {exc}")

# Initialize engines
config_engine = ConfigEngine()
workflow_engine = WorkflowEngine()
notification_service = NotificationService()

# Add this helper function after your imports
def can_access_application_by_hierarchy(user: Dict[str, Any], application: Dict[str, Any]) -> bool:
    """
    Check if user can access an application based on hierarchy
    
    Args:
        user: User object with hierarchy information
        application: Application object with hierarchy fields
    
    Returns:
        bool: True if user can access, False otherwise
    """
    user_role = user.get('role')
    user_hierarchy = user.get('hierarchy', {})

    if 'super_admin' in _roles_list(user):
        return True
    
    # Citizens can only access their own applications
    if user.get('type') == 'user' or user_role == 'citizen':
        return user.get('user_id') == application.get('user_id')
        
    # Check assignment
    assigned_to = application.get('assigned_to')
    if assigned_to and assigned_to != user.get('user_id') and assigned_to != user.get('username'):
        # If assigned to someone else, only super_admin or users of a different role can access it
        if not user_has_any_role(user, 'super_admin'):
            service_type = application.get('document_type') or application.get('service_type')
            if service_type:
                service_config = config_engine.get_service_config(service_type)
                workflow_name = service_config.get('workflow', 'standard_document_workflow')
                workflow_states = workflow_engine.get_workflow(workflow_name).get('states', {})
                current_state = application.get('current_state', 'SUBMITTED')
                state_assigned_role = workflow_states.get(current_state, {}).get('assigned_role')
                
                # If the user's role is the one meant to handle this state, but it's assigned to someone else, hide it.
                if state_assigned_role and user_has_any_role(user, state_assigned_role):
                    return False
            
    # For admin users, check hierarchy
    service_level = application.get('service_level', 'zone')
    app_region = application.get('hierarchy_region')
    app_zone = application.get('hierarchy_zone')
    app_woreda = application.get('hierarchy_woreda')
    app_kebele = application.get('hierarchy_kebele')
    
    user_region = user_hierarchy.get('region')
    user_zone = user_hierarchy.get('zone')
    user_woreda = user_hierarchy.get('woreda')
    user_kebele = user_hierarchy.get('kebele')
    
    # Check based on service level
    if service_level == 'country':
        # Country level services can be seen by region admins? Only super_admin
        return user_has_any_role(user, 'super_admin')
    
    elif service_level == 'region':
        # Region level: user must be in same region
        return user_region == app_region or user_has_any_role(user, 'super_admin')
    
    elif service_level == 'zone':
        # Zone level: user must be in same zone OR higher level (region) with same region
        if user_zone == app_zone:
            return True
        if user_region == app_region and user_role in ['region_admin', 'verification_supervisor']:
            return True
        return user_has_any_role(user, 'super_admin')
    
    elif service_level == 'woreda':
        # Woreda level: user must be in same woreda, or same zone, or same region
        if user_woreda == app_woreda:
            return True
        if user_zone == app_zone:
            return True
        if user_region == app_region and user_role in ['region_admin', 'verification_supervisor']:
            return True
        return user_has_any_role(user, 'super_admin')
    
    elif service_level == 'kebele':
        # Kebele level: user must be in same kebele, or same woreda, or same zone, or same region
        if user_kebele == app_kebele:
            return True
        if user_woreda == app_woreda:
            return True
        if user_zone == app_zone:
            return True
        if user_region == app_region:
            return True
        return user_has_any_role(user, 'super_admin')
    
    # Default: check based on user's zone vs application's zone
    return user_zone == app_zone or user_has_any_role(user, 'super_admin')


def get_user_highest_level(user_hierarchy: Dict[str, Any]) -> str:
    """Get the highest non-null level in user's hierarchy"""
    level_order = ["country", "region", "zone", "woreda", "kebele"]
    for level in level_order:
        if user_hierarchy.get(level):
            return level
    return "kebele"
# ============ Pydantic Models ============

class FormData(BaseModel):
    pass

class ApplicationCreate(BaseModel):
    service_type: str
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    form_data: Dict[str, Any]

class ApplicationUpdate(BaseModel):
    action: str
    user_id: str
    comment: Optional[str] = None
    assign_to: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

class ApplicationResponse(BaseModel):
    application_id: str
    service_type: str
    user_name: str
    user_email: str
    form_data: Dict[str, Any]
    current_state: str
    status: str
    fee_amount: float
    fee_paid: bool
    created_at: str
    updated_at: str
    tracking_id: Optional[str] = None
    history: List[Dict[str, Any]]

# Authentication Models
class LoginRequest(BaseModel):
    phone_number: str = Field(..., pattern=r'^[0-9]{10}$')

class OTPVerifyRequest(BaseModel):
    phone_number: str
    otp: str
    full_name: Optional[str] = None

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    message: str
    is_new_user: Optional[bool] = None

# ============ Authentication Endpoints ============

@app.post("/api/auth/send-otp", response_model=AuthResponse)
def send_otp(request: LoginRequest):
    """Send OTP to user's phone number"""
    from .supabase_client import supabase
    
    otp = AuthHandler.generate_otp(request.phone_number)
    
    # Check if user exists
    user_response = supabase.table("users").select("id").eq("phone_number", request.phone_number).execute()
    is_new_user = len(user_response.data) == 0 if user_response.data is not None else True
    
    return {
        "success": True,
        "message": f"OTP sent to {request.phone_number}",
        "token": None,
        "user": None,
        "is_new_user": is_new_user
    }

@app.post("/api/auth/verify-otp", response_model=AuthResponse)
def verify_otp(request: OTPVerifyRequest):
    """Verify OTP and return JWT token"""
    from .supabase_client import supabase
    import time
    
    is_valid = AuthHandler.verify_otp(request.phone_number, request.otp)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    # Check if user exists
    user_response = supabase.table("users").select("*").eq("phone_number", request.phone_number).execute()
    
    if user_response.data and len(user_response.data) > 0:
        db_user = user_response.data[0]
        user_id = db_user["user_id"]
        role = db_user.get("role", "citizen")
        user_data = {
            "user_id": user_id,
            "username": db_user.get("username"),
            "name": db_user.get("full_name"),
            "phone_number": request.phone_number,
            "role": role,
            "type": "citizen"
        }
    else:
        # New user registration
        if not request.full_name:
            raise HTTPException(status_code=400, detail="Full name is required for registration.")
            
        user_id = str(uuid.uuid4())
        suffix = request.phone_number[-4:] if len(request.phone_number) >= 4 else request.phone_number
        timestamp_part = str(int(time.time()))[-4:]
        username = f"citizen_{suffix}_{timestamp_part}"
        
        now = datetime.utcnow().isoformat()
        
        new_user = {
            "user_id": user_id,
            "username": username,
            "phone_number": request.phone_number,
            "full_name": request.full_name,
            "role": "citizen",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        
        try:
            supabase.table("users").insert(new_user).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to register user: {exc}")
            
        user_data = {
            "user_id": user_id,
            "username": username,
            "name": request.full_name,
            "phone_number": request.phone_number,
            "role": "citizen",
            "type": "citizen"
        }
    
    token = AuthHandler.create_user_token(user_id, request.phone_number)
    
    return {
        "success": True,
        "token": token,
        "user": user_data,
        "message": "Login successful"
    }

@app.post("/api/auth/admin-login", response_model=AuthResponse)
def admin_login(request: AdminLoginRequest):
    """Admin login with username and password"""
    admin_data = AuthHandler.verify_admin_credentials(request.username, request.password)
    
    if not admin_data or "user_id" not in admin_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = AuthHandler.create_admin_token_from_db(admin_data)
    
    return {
        "success": True,
        "token": token,
        "user": admin_data,
        "message": f"Welcome {admin_data['name']}"
    }

@app.post("/api/auth/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/auth/me")
async def get_current_user_info(current_user = Depends(AuthHandler.get_current_user_required)):
    return current_user

# ============ Service Endpoints ============
@app.post("/api/workflow/reload")
def reload_workflow_config():
    """Reload workflow and config engines from database/files"""
    workflow_engine.reload()
    config_engine.reload()
    role_manager.reload()
    return {"success": True, "message": "Configuration reloaded"}

@app.get("/api/workflow/action-definitions")
def get_action_definitions():
    """Get dynamic payload definitions for actions"""
    return workflow_engine.get_action_definitions()

@app.get("/api/workflow/status-config")
def get_status_config():
    """Get status display names and colors dynamically from workflow definitions"""
    names = {}
    colors = {}
    # Gather from all workflows so every state is covered
    for wf_name, wf_def in workflow_engine.workflows.items():
        states = wf_def.get('states', {})
        if isinstance(states, dict):
            for state_key, state_cfg in states.items():
                if isinstance(state_cfg, dict):
                    if state_key not in names:
                        names[state_key] = state_cfg.get('display_name', state_key.replace('_', ' ').title())
                    if state_key not in colors:
                        colors[state_key] = state_cfg.get('color', '#6b7280')
    return {"names": names, "colors": colors}

@app.get("/api/services/all")
def get_all_services():
    return config_engine.get_all_services()

@app.get("/api/services/categories")
def get_service_categories():
    return config_engine.get_categories()

@app.get("/api/services/by-category/{category}")
def get_services_by_category(category: str):
    return config_engine.get_services_by_category(category)

@app.get("/api/services/search")
def search_services(q: str = ""):
    all_services = config_engine.get_all_services()
    if not q:
        return all_services
    
    q_lower = q.lower()
    results = []
    for service in all_services:
        if (q_lower in service['name'].lower() or 
            q_lower in service.get('description', '').lower()):
            results.append(service)
    return results

@app.get("/api/service/{service_id}")
def get_service_config(service_id: str):
    config = config_engine.get_service_config(service_id)
    if not config:
        raise HTTPException(status_code=404, detail="Service not found")
    config["service_id"] = service_id
    return config

@app.get("/api/service/{service_id}/fee")
def get_service_fee(service_id: str):
    config = config_engine.get_service_config(service_id)
    if not config:
        raise HTTPException(status_code=404, detail="Service not found")
    return {
        "service_id": service_id,
        "fee_amount": config.get('fee_amount', 0),
        "is_free": config.get('fee_amount', 0) == 0,
        "payment_required": config.get('fee_amount', 0) > 0,
        "currency": "INR"
    }

@app.get("/api/service/{service_id}/level")
def get_service_level(service_id: str):
    """Get service hierarchy level information"""
    level = config_engine.get_service_level(service_id)
    responsible_hierarchy = config_engine.get_service_responsible_hierarchy(service_id)
    return {
        "level": level,
        "responsible_hierarchy": responsible_hierarchy
    }

# ============ Backward Compatible Endpoints ============

@app.get("/")
def root():
    return {"message": "Document Management System API", "version": "2.0.0"}

@app.get("/api/documents/types")
def get_document_types():
    return config_engine.get_available_documents()

@app.get("/api/documents/{doc_type}/form-config")
def get_form_config(doc_type: str):
    config = config_engine.get_document_config(doc_type)
    if not config:
        raise HTTPException(status_code=404, detail="Document type not found")
    return config

# ============ Application Endpoints ============

@app.post("/api/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    service_type: str = Form(...),
    user_id: str = Form(...),
    user_name: str = Form(...),
    user_email: str = Form(...),
    user_phone: Optional[str] = Form(None),
    form_data: str = Form(...),
    multi_step_data: Optional[str] = Form(None),
    uploaded_files: List[UploadFile] = File(None),
    current_user = Depends(AuthHandler.get_current_user_required)
):
    # Parse JSON strings
    try:
        form_data_dict = json.loads(form_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid form_data JSON")
    
    multi_step_data_dict = {}
    if multi_step_data:
        try:
            multi_step_data_dict = json.loads(multi_step_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid multi_step_data JSON")
    
    # Pre-populate form_data_dict with uploaded file names for validation
    if uploaded_files:
        for file in uploaded_files:
            if file.filename:
                filename_parts = file.filename.split('___', 1)
                field_name = filename_parts[0] if len(filename_parts) > 1 else 'attachment'
                actual_filename = filename_parts[1] if len(filename_parts) > 1 else file.filename
                form_data_dict[field_name] = actual_filename

    service_config = config_engine.get_service_config(service_type)
    if not service_config:
        raise HTTPException(status_code=404, detail=f"Service '{service_type}' not found")
    
    is_valid, errors = config_engine.validate_form_data(service_type, form_data_dict)
    if not is_valid:
        print(f"Validation failed for {service_type}. Errors: {errors}")
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    # Handle file uploads to MinIO
    if uploaded_files:
        for file in uploaded_files:
            if file.filename:
                # Extract field name if provided (format: fieldName___filename)
                filename_parts = file.filename.split('___', 1)
                field_name = filename_parts[0] if len(filename_parts) > 1 else 'attachment'
                actual_filename = filename_parts[1] if len(filename_parts) > 1 else file.filename
                
                # Generate unique filename
                file_extension = Path(actual_filename).suffix
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                
                # Upload to MinIO
                try:
                    # Read file content
                    file_content = await file.read()
                    file_size = len(file_content)
                    import io
                    file_stream = io.BytesIO(file_content)
                    
                    # Upload to MinIO
                    minio_client.put_object(
                        MINIO_BUCKET,
                        unique_filename,
                        file_stream,
                        file_size,
                        content_type=file.content_type or 'application/octet-stream'
                    )
                    
                    # Store URL in dict
                    file_url = f"http://{os.getenv('MINIO_ENDPOINT', 'localhost:9000')}/{MINIO_BUCKET}/{unique_filename}"
                    form_data_dict[field_name] = file_url
                    
                except Exception as e:
                    print(f"File upload failed: {str(e)}")
                    # We continue even if file upload fails to allow testing without MinIO
                    pass
    
    app_id = f"{service_type.upper()}_{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now().isoformat()
    
    # Determine hierarchy routing based on service requirements and user location
    service_level = config_engine.get_service_level(service_type)
    responsible_hierarchy = config_engine.get_service_responsible_hierarchy(service_type)
    
    # Get user's hierarchy (for citizens, this might come from form_data or be determined differently)
    user_hierarchy = {}
    if current_user["type"] == "admin":
        user_hierarchy = current_user.get("hierarchy", {})
    else:
        # For citizens, extract location from form_data if provided, otherwise use defaults
        user_hierarchy = {
            "country": form_data_dict.get("country", "ETH"),  # Default to Ethiopia
            "region": form_data_dict.get("region"),  # May be None for national services
            "zone": form_data_dict.get("zone"),     # May be None for regional services
            "woreda": form_data_dict.get("woreda"), # May be None for zone services
            "kebele": form_data_dict.get("kebele")  # May be None for woreda services
        }
    
    # Set application hierarchy based on service level and user location
    app_hierarchy = {
        "country": user_hierarchy.get("country", "ETH"),
        "region": user_hierarchy.get("region") if service_level in ["woreda", "zone", "region"] else None,
        "zone": user_hierarchy.get("zone") if service_level in ["woreda", "zone"] else None,
        "woreda": user_hierarchy.get("woreda") if service_level == "woreda" else None,
        "kebele": user_hierarchy.get("kebele") if service_level == "kebele" else None
    }
    
    # Determine the department that should handle this application
    department = role_manager.get_service_department(service_type)
    
    # Merge multi_step_data into form_data to fit within Supabase schema
    if multi_step_data_dict:
        form_data_dict["_multi_step_data"] = multi_step_data_dict
        
    db_application = {
        "application_id": app_id,
        "document_type": service_type,
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "user_phone": user_phone,
        "form_data": form_data_dict,
        "current_state": "SUBMITTED",
        "status": "PENDING",
        "fee_amount": service_config.get('fee_amount', 0),
        "fee_paid": False,
        "payment_id": None,
        "hierarchy_country": app_hierarchy.get("country"),
        "hierarchy_region": app_hierarchy.get("region"),
        "hierarchy_zone": app_hierarchy.get("zone"),
        "hierarchy_woreda": app_hierarchy.get("woreda"),
        "hierarchy_kebele": app_hierarchy.get("kebele"),
        "service_level": service_level,
        "responsible_hierarchy": responsible_hierarchy,
        "department": department,
        "created_at": now,
        "updated_at": now,
        "processed_at": None,
        "completed_at": None,
        "tracking_id": None,
        "rejection_reason": None,
        "history": [{
            "timestamp": now,
            "state": "SUBMITTED",
            "action": "APPLICATION_SUBMITTED",
            "comment": "Application submitted",
            "actor_name": user_name
        }]
    }
    
    try:
        db_application = db_create_application(db_application)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database insert failed: {exc}")
    
    class MockApp:
        def __init__(self, data):
            for key, value in data.items():
                setattr(self, key, value)
            if hasattr(self, 'service_type') and not hasattr(self, 'document_type'):
                self.document_type = self.service_type
    
    mock_app = MockApp(db_application)
    notification_service.send_application_submitted(mock_app)
    
    response_data = db_application.copy()
    response_data["service_type"] = service_type
    
    return ApplicationResponse(**response_data)

@app.get("/api/applications/{application_id}")
async def get_application(application_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get application by ID with hierarchy access control"""
    application = db_get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check if user can access this application based on hierarchy
    if not can_access_application_by_hierarchy(current_user, application):
        print(f"Access denied: User {current_user.get('username')} cannot access application {application_id}")
        print(f"  User role: {current_user.get('role')}")
        print(f"  User hierarchy: {current_user.get('hierarchy', {})}")
        print(f"  App region: {application.get('hierarchy_region')}, zone: {application.get('hierarchy_zone')}")
        raise HTTPException(status_code=403, detail="You don't have permission to view this application")
    
    # Ensure service_type is present for frontend compatibility
    if "service_type" not in application and "document_type" in application:
        application["service_type"] = application["document_type"]
        
    return application

@app.get("/api/applications/user/{user_id}")
async def get_user_applications(user_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications for a user with hierarchy filtering"""
    
    # Get all applications for this citizen
    citizen_apps = get_applications_by_user(user_id)
    
    # If the requesting user is the citizen themselves, they can see their own apps
    if current_user.get('user_id') == user_id or current_user.get('username') == user_id:
        return citizen_apps
    
    # For admin users, filter by hierarchy
    filtered_apps = []
    for app in citizen_apps:
        if can_access_application_by_hierarchy(current_user, app):
            filtered_apps.append(app)
    
    return filtered_apps

# ============ FIXED: Use Workflow Engine for Status Updates ============
@app.get("/api/applications/{application_id}/available-actions")
async def get_application_actions(application_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get available actions for an application based on workflow state and user role"""
    application = db_get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    current_state = application.get('current_state', 'SUBMITTED')
    service_type = application.get('document_type') or application.get('service_type')
    
    if not service_type:
        return {"actions": []}
        
    service_config = config_engine.get_service_config(service_type)
    workflow_name = service_config.get('workflow') if service_config else None
    if not workflow_name:
        try:
            with open(workflow_engine.config_path, 'r') as f:
                wf_config = json.load(f)
                workflow_name = wf_config.get('service_to_workflow_mapping', {}).get(service_type, 'standard_document_workflow')
        except:
            workflow_name = 'standard_document_workflow'
    
    user_roles = _roles_list(current_user)
    user_permissions = role_manager.get_permissions_for_roles(user_roles)
    available_actions = workflow_engine.get_next_actions(
        workflow_name,
        current_state,
        user_roles=user_roles,
        user_hierarchy=current_user.get("hierarchy") or {},
        service_type=service_type,
        user_permissions=user_permissions,
    )
    
    # If this is a citizen request, they can only act on their own applications
    if current_user.get("type") == "user" and current_user.get("user_id") != application.get("user_id"):
        available_actions = []
        
    action_details = {}
    workflow_states = workflow_engine.get_workflow(workflow_name).get('states', {})
    for action in available_actions:
        # Find which state this action leads to
        next_state_name = workflow_states.get(current_state, {}).get('next_states', {}).get(action)
        if next_state_name:
            next_state_config = workflow_states.get(next_state_name, {})
            assigned_role = next_state_config.get('assigned_role')
            if assigned_role:
                action_details[action] = {
                    "assignable": True,
                    "target_role": assigned_role
                }
            else:
                action_details[action] = { "assignable": False }
        else:
            action_details[action] = { "assignable": False }
            
    return {"actions": available_actions, "action_details": action_details}

@app.get("/api/users/by-role/{role_name}")
async def get_users_by_role(role_name: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get active users matching a role in the same department and hierarchy"""
    from .supabase_client import supabase
    
    # We enforce same department if not super_admin or all
    query = supabase.table("users").select("user_id, username, full_name, department, hierarchy_country, hierarchy_region, hierarchy_zone, hierarchy_woreda, hierarchy_kebele").eq("is_active", True)
    
    # Filter by role
    query = query.eq("role", role_name)
    
    user_dept = current_user.get("department")
    is_super_admin = "super_admin" in (current_user.get("roles") or [])
    
    if not is_super_admin and user_dept and user_dept != "all":
        query = query.eq("department", user_dept)
        
    res = query.execute()
    users = res.data or []
    
    # Filter by hierarchy level match
    filtered_users = []
    user_h = current_user.get("hierarchy", {})
    
    for u in users:
        if is_super_admin:
            filtered_users.append(u)
            continue
            
        # Match hierarchy
        match = True
        for level in ["country", "region", "zone", "woreda", "kebele"]:
            if user_h.get(level) and u.get(f"hierarchy_{level}"):
                if user_h.get(level) != u.get(f"hierarchy_{level}"):
                    match = False
                    break
        if match:
            filtered_users.append(u)
            
    return filtered_users

@app.put("/api/applications/{application_id}/status")
async def update_application_status(application_id: str, update: ApplicationUpdate, current_user = Depends(AuthHandler.get_current_user_required)):
    application = db_get_application(application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    old_state = application['current_state']
    service_type = application.get('document_type') or application.get('service_type')
    
    # Get service config to know which workflow to use
    service_config = config_engine.get_service_config(service_type)
    workflow_name = service_config.get('workflow') if service_config else None
    if not workflow_name:
        try:
            with open(workflow_engine.config_path, 'r') as f:
                workflow_name = json.load(f).get('service_to_workflow_mapping', {}).get(service_type, 'standard_document_workflow')
        except:
            workflow_name = 'standard_document_workflow'
    
    print(f"Service: {service_type}, Workflow: {workflow_name}, Current state: {old_state}, Action: {update.action}")
    
    # Determine allowed actions for this user based on workflow state and role assignment
    user_roles = _roles_list(current_user)
    user_permissions = role_manager.get_permissions_for_roles(user_roles)
    available_actions = workflow_engine.get_next_actions(
        workflow_name,
        old_state,
        user_roles=user_roles,
        user_hierarchy=current_user.get("hierarchy") or {},
        service_type=service_type,
        user_permissions=user_permissions,
    )
    
    if update.action not in available_actions:
        raise HTTPException(status_code=403, detail=f"Action '{update.action}' not permitted for your role in state '{old_state}'")
    
    # If this is a citizen request, only allow actions on their own applications
    if current_user["type"] == "user" and current_user.get("user_id") != application.get("user_id"):
        raise HTTPException(status_code=403, detail="Citizens can only act on their own applications")
    
    # Transition using the service's workflow
    new_state, notification, sla_warning = workflow_engine.transition(
        workflow_name, old_state, update.action, application
    )
    
    # Process assignments
    if update.assign_to:
        application['assigned_to'] = update.assign_to
    elif update.action in ["RESOLVE", "REJECT", "CANCEL", "COMPLETED"]:
        # Optionally clear assignment on terminal states, but we can leave it for record keeping
        pass
        
    if new_state and new_state != old_state:
        application['current_state'] = new_state
        application['status'] = new_state
        application['updated_at'] = datetime.now().isoformat()
        
        actor_name = current_user.get("name") or current_user.get("username") or "System"
        
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "state": new_state,
            "action": update.action,
            "comment": update.comment or "",
            "actor_name": actor_name
        }
        if update.payload:
            history_entry["payload"] = update.payload
            
        application['history'].append(history_entry)
        
        if sla_warning:
            application['history'].append({
                "timestamp": datetime.now().isoformat(),
                "state": "SLA_WARNING",
                "action": "SYSTEM",
                "comment": sla_warning,
                "actor_name": "System"
            })
            
        if update.action == "ASSIGN_TO_LME":
            application['assigned_to'] = update.assign_to
            application['assigned_at'] = datetime.now().isoformat()
        elif update.action == "REASSIGN":
            application['assigned_to'] = None
            application['assigned_at'] = None
        
        if new_state == "COMPLETED":
            application['completed_at'] = datetime.now().isoformat()
            application['tracking_id'] = f"TRACK_{uuid.uuid4().hex[:6].upper()}"
        
        update_application(application_id, application)
        
        # Send notifications
        if update.assign_to:
            notification_service.send_assignment_notification(application, update.assign_to)
        
        notification_service.send_status_update(application, update.comment or "")
    
    elif update.assign_to and not new_state:
        # State didn't change, but assignment did
        update_application(application_id, application)
        notification_service.send_assignment_notification(application, update.assign_to)
    
    return {"status": "success", "new_state": application['current_state']}

# ============ Notification Endpoints ============

@app.get("/api/notifications")
async def get_notifications(current_user = Depends(AuthHandler.get_current_user_required)):
    """Fetch all notifications for the logged-in user, newest first."""
    from .supabase_client import supabase
    user_id = current_user.get("user_id")
    try:
        res = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
        return res.data or []
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return []

# IMPORTANT: /read-all MUST be declared before /{notification_id}/read
# so FastAPI does not greedily match "read-all" as a notification_id.
@app.put("/api/notifications/read-all")
async def mark_all_notifications_read(current_user = Depends(AuthHandler.get_current_user_required)):
    """Mark all unread notifications as read for the logged-in user."""
    from .supabase_client import supabase
    user_id = current_user.get("user_id")
    try:
        supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
        return {"success": True}
    except Exception as e:
        print(f"Error marking all notifications read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notifications as read")

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, current_user = Depends(AuthHandler.get_current_user_required)):
    """Mark a single notification as read. Only affects notifications owned by the current user."""
    from .supabase_client import supabase
    user_id = current_user.get("user_id")
    try:
        res = supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error marking notification {notification_id} as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")

# ============ Helper to Calculate Dynamic Stats ============

def calculate_application_stats(apps):
    
    total = len(apps)
    pending = 0
    completed = 0
    rejected = 0
    
    for app in apps:
        service_type = app.get("service_type") or app.get("document_type")
        current_state = app.get("current_state") or app.get("status") or "SUBMITTED"
        
        # Determine state type
        state_type = "internal"
        
        # Get service config to determine workflow
        service_config = config_engine.get_service_config(service_type) if service_type else None
        workflow_name = service_config.get('workflow') if service_config else None
        
        # Look up state type from workflows definition
        if workflow_name and workflow_name in workflow_engine.workflows:
            wf = workflow_engine.workflows[workflow_name]
            states = wf.get("states", {})
            if current_state in states:
                state_type = states[current_state].get("type", "internal")
        else:
            # Fallback based on typical states if no workflow config available
            if current_state in ["COMPLETED", "RESOLVED"]:
                state_type = "end"
            elif current_state == "REJECTED":
                state_type = "rejected_end"
        
        # Map state type to stats
        if state_type == "end" or current_state == "REJECTED" or state_type == "rejected_end":
            completed += 1
            if current_state == "REJECTED" or state_type == "rejected_end":
                rejected += 1
        else:
            pending += 1
            
    return {
        "total": total,
        "pending": pending,
        "completed": completed,
        "rejected": rejected
    }

# ============ Admin Endpoints ============

@app.get("/api/admin/dashboard")
async def admin_dashboard(current_user = Depends(AuthHandler.get_current_user_required)):
    """Admin dashboard with hierarchy filtering"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Filter applications by hierarchy
    all_apps = get_all_applications()
    filtered_apps = []
    for app in all_apps:
        if can_access_application_by_hierarchy(current_user, app):
            filtered_apps.append(app)
    
    stats_data = calculate_application_stats(filtered_apps)
    return {
        "total": stats_data["total"],
        "pending": stats_data["pending"],
        "completed": stats_data["completed"],
        "rejected": stats_data["rejected"],
        "user": current_user
    }
    
@app.get("/api/admin/dashboard/department")
async def get_department_dashboard(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get department-specific dashboard data with hierarchy filtering"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user's role, department, and hierarchy
    user_role = current_user.get("role")
    user_department = current_user.get("department")
    user_hierarchy = current_user.get("hierarchy", {})
    
    # First, filter by department (if not super_admin)
    if user_has_any_role(current_user, "super_admin"):
        dept_filtered_apps = get_all_applications()
    else:
        dept_filtered_apps = get_applications_by_department(user_department) if user_department and user_department != "all" else get_all_applications()
    
    # Second, filter by hierarchy (geographic jurisdiction)
    hierarchy_filtered_apps = []
    for app in dept_filtered_apps:
        if can_access_application_by_hierarchy(current_user, app):
            hierarchy_filtered_apps.append(app)
    
    print(f"User: {current_user.get('username')}")
    print(f"Role: {user_role}, Department: {user_department}")
    print(f"User hierarchy: {user_hierarchy}")
    all_apps = get_all_applications()
    print(f"Total apps: {len(all_apps)}")
    print(f"After department filter: {len(dept_filtered_apps)}")
    print(f"After hierarchy filter: {len(hierarchy_filtered_apps)}")
    
    stats_data = calculate_application_stats(hierarchy_filtered_apps)
    return {
        "user": current_user,
        "stats": stats_data,
        "applications": hierarchy_filtered_apps[:50]
    }

@app.get("/api/admin/dashboard/stats")
async def get_dashboard_stats(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get dashboard statistics for the current user"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get user's accessible applications
    if user_has_any_role(current_user, "super_admin"):
        all_apps = get_all_applications()
    else:
        user_department = current_user.get("department")
        all_apps = get_applications_by_department(user_department) if user_department and user_department != "all" else get_all_applications()

    # Filter by hierarchy
    accessible_apps = []
    for app in all_apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return calculate_application_stats(accessible_apps)

@app.get("/api/applications/user/{user_id}/stats")
async def get_user_applications_stats(user_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get statistics of applications for a specific citizen user"""
    if current_user.get('user_id') != user_id and current_user.get('username') != user_id and current_user.get('type') != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view these stats")
        
    citizen_apps = get_applications_by_user(user_id)
    return calculate_application_stats(citizen_apps)

@app.get("/api/admin/dashboard/verification")
async def get_verification_queue(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications pending verification for the current user"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get applications in verification states
    verification_states = ['SUBMITTED', 'VERIFICATION']
    all_apps = get_all_applications()
    apps = [app for app in all_apps if app.get('current_state') in verification_states]

    # Filter by user's access
    accessible_apps = []
    for app in apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return accessible_apps

@app.get("/api/admin/dashboard/documents")
async def get_document_verification_queue(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications pending document verification"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get applications in document verification state
    all_apps = get_all_applications()
    apps = [app for app in all_apps if app.get('current_state') == 'DOCUMENT_VERIFICATION']

    # Filter by user's access
    accessible_apps = []
    for app in apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return accessible_apps

@app.get("/api/admin/dashboard/payments")
async def get_payment_queue(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications pending payment processing"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get applications in payment states
    payment_states = ['PAYMENT_PENDING', 'PAYMENT_COMPLETED']
    all_apps = get_all_applications()
    apps = [app for app in all_apps if app.get('current_state') in payment_states]

    # Filter by user's access
    accessible_apps = []
    for app in apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return accessible_apps

@app.get("/api/admin/dashboard/certificates")
async def get_certificate_queue(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications ready for certificate issuance"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get applications that have completed all processing and are ready for issuance
    all_apps = get_all_applications()
    apps = [app for app in all_apps if app.get('current_state') == 'PAYMENT_COMPLETED']

    # Filter by user's access
    accessible_apps = []
    for app in apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return accessible_apps

@app.get("/api/admin/dashboard/audit")
async def get_audit_queue(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get applications pending quality audit"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get completed applications for audit (this would need to be implemented based on business logic)
    # For now, return a subset of completed applications
    all_apps = get_all_applications()
    completed_apps = [app for app in all_apps if app.get('current_state') == 'COMPLETED']

    # Filter by user's access
    accessible_apps = []
    for app in completed_apps:
        if can_access_application_by_hierarchy(current_user, app):
            accessible_apps.append(app)

    return accessible_apps[:20]  # Return last 20 completed applications

# ============ User Management Models ============

class UserCreate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: str
    full_name: str
    role: str
    department: Optional[str] = None
    hierarchy_country: Optional[str] = None
    hierarchy_region: Optional[str] = None
    hierarchy_zone: Optional[str] = None
    hierarchy_woreda: Optional[str] = None
    hierarchy_kebele: Optional[str] = None
    password: Optional[str] = None  # For admin users

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    hierarchy_country: Optional[str] = None
    hierarchy_region: Optional[str] = None
    hierarchy_zone: Optional[str] = None
    hierarchy_woreda: Optional[str] = None
    hierarchy_kebele: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    user_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: str
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    last_login: Optional[str] = None
    hierarchy_country: Optional[str] = None
    hierarchy_region: Optional[str] = None
    hierarchy_zone: Optional[str] = None
    hierarchy_woreda: Optional[str] = None
    hierarchy_kebele: Optional[str] = None


class RoleDefinitionCreate(BaseModel):
    role_name: str
    display_name: str
    description: Optional[str] = ""
    permissions: List[str] = []
    departments: List[str] = []
    priority: int = 0
    can_assign_roles: bool = False


class RoleDefinitionUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    priority: Optional[int] = None
    can_assign_roles: Optional[bool] = None


class ServiceDefinitionUpsert(BaseModel):
    service_kind: str
    config: Dict[str, Any]
    is_active: bool = True


class WorkflowUpsert(BaseModel):
    definition: Dict[str, Any]
    is_active: bool = True


class LocalizationUpsert(BaseModel):
    display_name: Optional[str] = None
    translations: Dict[str, Any]


class AppSettingUpsert(BaseModel):
    value: Dict[str, Any]


class UserRoleAssign(BaseModel):
    role_name: str

# ============ User Management Endpoints ============
@app.get("/api/admin/roles")
async def get_roles(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get all available roles"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if role_manager._use_db:
        role_manager.reload()
    roles = role_manager.get_all_roles()
    # Ensure the citizen role is visible even if configured separately
    if not any(r["role_id"] == "citizen" for r in roles):
        roles.append({
            "role_id": "citizen",
            "name": "Citizen",
            "description": "Regular citizen user",
            "permissions": ["create_application", "view_own_applications"],
            "departments": [],
            "priority": 0,
            "can_assign_roles": False,
        })

    return {"roles": sorted(roles, key=lambda x: x.get("priority", 0), reverse=True)}


@app.get("/api/admin/users/{user_id}/roles")
async def get_user_roles(user_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get roles for a specific user"""
    if current_user["type"] != "admin" or not user_has_any_role(current_user, "super_admin", "system_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from .supabase_client import supabase
        
        # Get user's primary role from users table
        user_result = supabase.table('users').select('role').eq('user_id', user_id).execute()
        primary_role = user_result.data[0]['role'] if user_result.data else None
        
        # Get additional roles from user_roles table
        try:
            roles_result = supabase.table('user_roles').select('role_name').eq('user_id', user_id).execute()
            extra_roles = [r['role_name'] for r in (roles_result.data or [])]
        except:
            extra_roles = []
        
        # Combine roles (primary first, then unique extras)
        all_roles = []
        if primary_role:
            all_roles.append(primary_role)
        for role in extra_roles:
            if role != primary_role and role not in all_roles:
                all_roles.append(role)
        
        # If no roles found, return citizen as default
        if not all_roles:
            all_roles = ["citizen"]
        
        return {"user_id": user_id, "roles": all_roles}
        
    except Exception as exc:
        print(f"Error fetching user roles: {exc}")
        # Return default role as fallback
        return {"user_id": user_id, "roles": ["citizen"]}
@app.delete("/api/admin/users/{user_id}/roles/{role_name}")
async def admin_remove_user_role(
    user_id: str,
    role_name: str,
    current_user = Depends(AuthHandler.get_current_user_required),
):
    if current_user["type"] != "admin" or not user_has_any_role(current_user, "super_admin", "system_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    from .supabase_client import supabase

    try:
        u = supabase.table("users").select("role").eq("user_id", user_id).limit(1).execute()
    except Exception as exc:
        _raise_if_user_roles_table_missing(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if u.data and u.data[0].get("role") == role_name:
        raise HTTPException(status_code=400, detail="Cannot remove primary role; change users.role first")
    try:
        supabase.table("user_roles").delete().eq("user_id", user_id).eq("role_name", role_name).execute()
    except Exception as exc:
        _raise_if_user_roles_table_missing(exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"ok": True}






@app.post("/api/admin/users/{user_id}/roles")
async def admin_assign_user_role(
    user_id: str,
    payload: UserRoleAssign,
    current_user = Depends(AuthHandler.get_current_user_required),
):
    if current_user["type"] != "admin" or not user_has_any_role(current_user, "super_admin", "system_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    from .supabase_client import supabase

    if not role_manager.get_role_config(payload.role_name):
        raise HTTPException(status_code=400, detail="Unknown role")
    try:
        supabase.table("user_roles").insert({"user_id": user_id, "role_name": payload.role_name}).execute()
    except Exception as exc:
        _raise_if_user_roles_table_missing(exc)
        if "duplicate" not in str(exc).lower() and "unique" not in str(exc).lower():
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"ok": True, "user_id": user_id, "role_name": payload.role_name}



@app.post("/api/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, current_user = Depends(AuthHandler.get_current_user_required)):
    """Create a new user (admin only)"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    has_manage_users = user_has_any_role(current_user, "super_admin", "system_admin") or role_manager.has_any_permission(_roles_list(current_user), "manage_users")
    if not has_manage_users:
        raise HTTPException(status_code=403, detail="Permission 'manage_users' required")
        
    target_hierarchy = {
        "country": user_data.hierarchy_country,
        "region": user_data.hierarchy_region,
        "zone": user_data.hierarchy_zone,
        "woreda": user_data.hierarchy_woreda,
        "kebele": user_data.hierarchy_kebele
    }
    if not hierarchy_manager.is_in_admin_scope(current_user, target_hierarchy, user_data.department):
        raise HTTPException(status_code=403, detail="Target user is outside of your administrative scope")

    try:
        from .user_manager import user_manager

        # Prepare user data for user_manager
        user_dict = {
            "username": user_data.username,
            "full_name": user_data.full_name,
            "email": user_data.email,
            "phone_number": user_data.phone_number,
            "role": user_data.role,
            "department": user_data.department,
            "hierarchy": {
                "country": user_data.hierarchy_country,
                "region": user_data.hierarchy_region,
                "zone": user_data.hierarchy_zone,
                "woreda": user_data.hierarchy_woreda,
                "kebele": user_data.hierarchy_kebele
            },
            "password": user_data.password or "default123",  # Default password if not provided
            "is_active": True
        }

        created_user = user_manager.create_user(user_dict, current_user.get("user_id", "system"))

        if not created_user:
            raise HTTPException(status_code=500, detail="Failed to create user")

        return UserResponse(**created_user)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {exc}")

@app.get("/api/admin/users")
async def get_users(
    current_user = Depends(AuthHandler.get_current_user_required),
    role: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0
):
    """Get users list (admin only) with pagination and roles included"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    has_manage_users = user_has_any_role(current_user, "super_admin", "system_admin") or role_manager.has_any_permission(_roles_list(current_user), "manage_users")
    if not has_manage_users:
        raise HTTPException(status_code=403, detail="Permission 'manage_users' required")
        
    if not user_has_any_role(current_user, "super_admin", "system_admin"):
        if current_user.get("department"):
            department = current_user.get("department")

    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100
    if offset < 0:
        offset = 0

    try:
        from .user_manager import user_manager

        result = user_manager.get_users_paginated(limit=limit, offset=offset, role=role, department=department)
        users = result.get('users', [])
        
        if not user_has_any_role(current_user, "super_admin", "system_admin"):
            filtered_users = []
            for u in users:
                target_hierarchy = {
                    "country": u.get("hierarchy_country"),
                    "region": u.get("hierarchy_region"),
                    "zone": u.get("hierarchy_zone"),
                    "woreda": u.get("hierarchy_woreda"),
                    "kebele": u.get("hierarchy_kebele")
                }
                if hierarchy_manager.is_in_admin_scope(current_user, target_hierarchy, u.get("department")):
                    filtered_users.append(u)
            users = filtered_users
            total = len(users)
        else:
            total = result.get('total', 0)

        if is_active is not None:
            users = [u for u in users if u.get('is_active') == is_active]

        user_ids = [u['user_id'] for u in users if u.get('user_id')]
        extra_role_map = user_manager.get_roles_for_user_ids(user_ids)

        for user in users:
            user_id = user.get('user_id')
            primary_role = user.get('role')
            roles = []
            if primary_role:
                roles.append(primary_role)
            for extra_role in extra_role_map.get(user_id, []):
                if extra_role != primary_role:
                    roles.append(extra_role)
            user['roles'] = roles
            user['extra_roles'] = [r for r in roles if r != primary_role]

        return {
            "users": users,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {exc}")


def _raise_if_user_roles_table_missing(exc: Exception) -> None:
    msg = str(exc).lower()
    if "user_roles" in msg or "does not exist" in msg or "pgrst205" in msg or "42p01" in msg:
        raise HTTPException(
            status_code=503,
            detail="Table user_roles is missing. Open Supabase SQL Editor and run backend/supabase_config_tables.sql, then restart the API.",
        ) from exc





@app.get("/api/admin/users/{user_id}")
async def get_user(user_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Get user details (admin only)"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    has_manage_users = user_has_any_role(current_user, "super_admin", "system_admin") or role_manager.has_any_permission(_roles_list(current_user), "manage_users")
    if not has_manage_users:
        raise HTTPException(status_code=403, detail="Permission 'manage_users' required")

    try:
        from .user_manager import user_manager
        user = user_manager.get_user_by_id(user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        target_hierarchy = {
            "country": user.get("hierarchy_country"),
            "region": user.get("hierarchy_region"),
            "zone": user.get("hierarchy_zone"),
            "woreda": user.get("hierarchy_woreda"),
            "kebele": user.get("hierarchy_kebele")
        }
        if not hierarchy_manager.is_in_admin_scope(current_user, target_hierarchy, user.get("department")):
            raise HTTPException(status_code=403, detail="User is outside of your administrative scope")

        return user

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user: {exc}")

@app.put("/api/admin/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str, 
    user_data: UserUpdate, 
    current_user = Depends(AuthHandler.get_current_user_required)
):
    """Update user (admin only)"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    has_manage_users = user_has_any_role(current_user, "super_admin", "system_admin") or role_manager.has_any_permission(_roles_list(current_user), "manage_users")
    if not has_manage_users:
        raise HTTPException(status_code=403, detail="Permission 'manage_users' required")

    try:
        from .user_manager import user_manager

        # Check existing user
        existing_user = user_manager.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        target_hierarchy = {
            "country": existing_user.get("hierarchy_country"),
            "region": existing_user.get("hierarchy_region"),
            "zone": existing_user.get("hierarchy_zone"),
            "woreda": existing_user.get("hierarchy_woreda"),
            "kebele": existing_user.get("hierarchy_kebele")
        }
        if not hierarchy_manager.is_in_admin_scope(current_user, target_hierarchy, existing_user.get("department")):
            raise HTTPException(status_code=403, detail="User is outside of your administrative scope")

        # Prepare update data
        update_data = user_data.dict(exclude_unset=True)
        
        # Verify new target scope if hierarchy or department is updated
        new_hierarchy = {**target_hierarchy}
        if "hierarchy_country" in update_data: new_hierarchy["country"] = update_data["hierarchy_country"]
        if "hierarchy_region" in update_data: new_hierarchy["region"] = update_data["hierarchy_region"]
        if "hierarchy_zone" in update_data: new_hierarchy["zone"] = update_data["hierarchy_zone"]
        if "hierarchy_woreda" in update_data: new_hierarchy["woreda"] = update_data["hierarchy_woreda"]
        if "hierarchy_kebele" in update_data: new_hierarchy["kebele"] = update_data["hierarchy_kebele"]
        new_department = update_data.get("department", existing_user.get("department"))
        
        if not hierarchy_manager.is_in_admin_scope(current_user, new_hierarchy, new_department):
            raise HTTPException(status_code=403, detail="Cannot move user outside of your administrative scope")

        updated_user = user_manager.update_user(user_id, update_data)

        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")

        return UserResponse(**updated_user)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {exc}")

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    """Deactivate user (admin only) - soft delete"""
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    has_manage_users = user_has_any_role(current_user, "super_admin", "system_admin") or role_manager.has_any_permission(_roles_list(current_user), "manage_users")
    if not has_manage_users:
        raise HTTPException(status_code=403, detail="Permission 'manage_users' required")

    try:
        from .user_manager import user_manager

        # Check existing user
        existing_user = user_manager.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
            
        target_hierarchy = {
            "country": existing_user.get("hierarchy_country"),
            "region": existing_user.get("hierarchy_region"),
            "zone": existing_user.get("hierarchy_zone"),
            "woreda": existing_user.get("hierarchy_woreda"),
            "kebele": existing_user.get("hierarchy_kebele")
        }
        if not hierarchy_manager.is_in_admin_scope(current_user, target_hierarchy, existing_user.get("department")):
            raise HTTPException(status_code=403, detail="User is outside of your administrative scope")

        success = user_manager.deactivate_user(user_id)

        if not success:
            raise HTTPException(status_code=404, detail="User not found")

        return {"success": True, "message": "User deactivated successfully"}

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to deactivate user: {exc}")


@app.get("/api/admin/audit-logs")
async def get_audit_logs(
    current_user = Depends(AuthHandler.get_current_user_required),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get audit logs (admin only)"""
    if current_user["type"] != "admin" or not user_has_any_role(current_user, "super_admin", "system_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from .supabase_client import supabase
        query = supabase.table('audit_logs').select('*')
        
        if user_id:
            query = query.eq('user_id', user_id)
        if action:
            query = query.eq('action', action)
        
        result = query.order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        logs = result.data if result.data else []
        
        return {
            "logs": logs,
            "total": len(logs),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {exc}")

# ============ Citizen Profile Endpoints ============

@app.get("/api/user/profile")
async def get_user_profile(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get current user's profile"""
    try:
        from .supabase_client import supabase
        
        # For citizens, we might not have them in the users table yet
        # Try to find them, if not found, return basic info
        if current_user.get("type") == "user" or current_user.get("role") == "citizen":
            user_id = current_user.get("user_id")
            result = supabase.table('users').select('*').eq('user_id', user_id).execute()
            user = result.data[0] if result.data else None
            
            if user:
                return user
            else:
                # Return basic citizen profile
                return {
                    "user_id": user_id,
                    "phone_number": current_user.get("phone_number"),
                    "full_name": current_user.get("name", "Citizen"),
                    "role": "citizen",
                    "is_active": True
                }
        else:
            # Admin user - should exist in database
            user_id = current_user.get("user_id")
            result = supabase.table('users').select('*').eq('user_id', user_id).execute()
            user = result.data[0] if result.data else None
            
            if not user:
                raise HTTPException(status_code=404, detail="User profile not found")
            
            return user
            
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {exc}")

@app.put("/api/user/profile")
async def update_user_profile(
    profile_data: UserUpdate, 
    current_user = Depends(AuthHandler.get_current_user_required)
):
    """Update current user's profile"""
    user_id = current_user.get("user_id")
    
    try:
        from .supabase_client import supabase
        
        # Prepare update data - citizens can only update certain fields
        if current_user.get("type") == "user" or current_user.get("role") == "citizen":
            # Citizens can only update name and email
            allowed_fields = ["full_name", "email"]
            update_data = {k: v for k, v in profile_data.dict(exclude_unset=True).items() if k in allowed_fields}
        else:
            # Admins can update more fields but not role/department (unless super_admin)
            update_data = profile_data.dict(exclude_unset=True)
            if not user_has_any_role(current_user, "super_admin"):
                update_data.pop("role", None)
                update_data.pop("department", None)
        
        update_data["updated_at"] = datetime.now().isoformat()
        
        # Hash password if provided
        if "password" in update_data:
            update_data["password_hash"] = AuthHandler.hash_password(update_data.pop("password"))
        
        result = supabase.table('users').update(update_data).eq('user_id', user_id).execute()
        updated_user = result.data[0] if result.data else None
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return updated_user
        
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {exc}")

# ============ User Management Endpoints ============

# ============ Frontend Configuration Endpoint (Single version) ============

@app.get("/api/frontend/config")
async def get_frontend_config(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get complete frontend configuration based on user role"""
    
    is_admin = current_user["type"] == "admin"
    role = current_user.get("role") if is_admin else "citizen"
    department = current_user.get("department") if is_admin else None
    all_roles = _roles_list(current_user)

    permissions: List[str] = []
    if is_admin:
        for rn in all_roles:
            rc = role_manager.get_role_config(rn)
            if not rc:
                continue
            perms = rc.get("permissions", [])
            if "*" in perms:
                permissions = ["*"]
                break
            for p in perms:
                if p not in permissions:
                    permissions.append(p)
    else:
        permissions = ["create_application", "view_own_applications"]
    
    # Build dashboard sections dynamically based on role and permissions
    dashboard_sections = []
    
    if is_admin:
        # Dynamic dashboard sections based on user role and department
        user_role = current_user.get("role")
        user_department = current_user.get("department")
        user_hierarchy = current_user.get("hierarchy", {})
        user_level = user_hierarchy.get("level")
        
        # Stats section for all admins
        dashboard_sections.append({
            "id": "stats",
            "title": "Dashboard Statistics",
            "type": "stats_cards",
            "icon": "📊",
            "endpoint": "/api/admin/dashboard/stats"
        })
        
        # Applications section - filtered by department and hierarchy
        app_title = "All Applications"
        if user_department and user_department != "all":
            app_title = f"{user_department.title()} Applications"
        if user_level:
            app_title += f" ({user_level.title()} Level)"
            
        dashboard_sections.append({
            "id": "applications",
            "title": app_title,
            "type": "applications_list",
            "icon": "📋",
            "endpoint": "/api/admin/dashboard/department",
            "limit": 20,
            "show_view_all": True,
            "view_all_link": "/admin/applications"
        })
        
        # Department-specific sections based on role
        if user_role == "verification_officer" or user_role == "verification_supervisor":
            dashboard_sections.append({
                "id": "pending_verification",
                "title": "Pending Verification",
                "type": "applications_list",
                "icon": "🔍",
                "endpoint": "/api/admin/dashboard/verification",
                "limit": 10,
                "show_view_all": True,
                "view_all_link": "/admin/verify"
            })
            
        if user_role == "document_verifier" or user_role == "senior_document_verifier":
            dashboard_sections.append({
                "id": "document_checks",
                "title": "Document Verification Queue",
                "type": "applications_list",
                "icon": "📄",
                "endpoint": "/api/admin/dashboard/documents",
                "limit": 10,
                "show_view_all": True,
                "view_all_link": "/admin/documents"
            })
            
        if user_role == "payment_officer" or user_role == "payment_approver":
            dashboard_sections.append({
                "id": "payment_pending",
                "title": "Payment Processing",
                "type": "applications_list",
                "icon": "💰",
                "endpoint": "/api/admin/dashboard/payments",
                "limit": 10,
                "show_view_all": True,
                "view_all_link": "/admin/payments"
            })
            
        if user_role == "certificate_issuer":
            dashboard_sections.append({
                "id": "ready_for_issue",
                "title": "Ready for Certificate Issuance",
                "type": "applications_list",
                "icon": "📜",
                "endpoint": "/api/admin/dashboard/certificates",
                "limit": 10,
                "show_view_all": True,
                "view_all_link": "/admin/issue"
            })
            
        if user_role == "quality_auditor":
            dashboard_sections.append({
                "id": "audit_queue",
                "title": "Quality Audit Queue",
                "type": "applications_list",
                "icon": "🔍",
                "endpoint": "/api/admin/dashboard/audit",
                "limit": 10,
                "show_view_all": True,
                "view_all_link": "/admin/audit"
            })
            
        # Quick actions based on role
        quick_actions = []
        if user_has_any_role(current_user, "verification_officer", "verification_supervisor"):
            quick_actions.append({"label": "Verify Applications", "link": "/admin/verify", "icon": "✅"})
        if user_has_any_role(current_user, "document_verifier"):
            quick_actions.append({"label": "Check Documents", "link": "/admin/documents", "icon": "📄"})
        if user_has_any_role(current_user, "payment_officer"):
            quick_actions.append({"label": "Process Payments", "link": "/admin/payments", "icon": "💰"})
        if user_has_any_role(current_user, "certificate_issuer"):
            quick_actions.append({"label": "Issue Certificates", "link": "/admin/issue", "icon": "📜"})
        if user_has_any_role(current_user, "super_admin"):
            quick_actions.append({"label": "Manage Users", "link": "/admin/users", "icon": "👥"})
            quick_actions.append({"label": "Manage Roles", "link": "/admin/roles", "icon": "🎭"})
            
        if quick_actions:
            dashboard_sections.append({
                "id": "quick_actions",
                "title": "Quick Actions",
                "type": "quick_actions",
                "icon": "⚡",
                "actions": quick_actions
            })
        
    else:
        # Citizen dashboard sections
        dashboard_sections.append({
            "id": "stats",
            "title": "Your Statistics",
            "type": "stats_cards",
            "icon": "📊",
            "endpoint": f"/api/applications/user/{current_user.get('user_id') or current_user.get('username')}/stats"
        })
        dashboard_sections.append({
            "id": "quick_actions",
            "title": "Quick Actions",
            "type": "quick_actions",
            "icon": "⚡",
            "actions": [
                {"label": "Apply for Service", "link": "/apply", "icon": "📝"}
            ]
        })
        dashboard_sections.append({
            "id": "applications",
            "title": "Your Applications",
            "type": "applications_list",
            "icon": "📋",
            "endpoint": f"/api/applications/user/{current_user.get('user_id') or current_user.get('username')}",
            "limit": 5,
            "show_view_all": True,
            "view_all_link": "/track"
        })
    
    frontend_config = {
        "user": {
            "name": current_user.get("name") or current_user.get("username") or current_user.get("user_id") or "Citizen",
            "full_name": current_user.get("name") or current_user.get("username") or "User",
            "role": role,
            "roles": all_roles,
            "type": current_user.get("type", "citizen"),
            "department": department,
            "permissions": permissions,
            "profile_picture_url": current_user.get("profile_picture_url"),
            "phone_number": current_user.get("phone_number")
        },
        "navigation": {
            "items": []
        },
        "dashboard": {
            "type": "admin" if is_admin else "citizen",
            "sections": dashboard_sections
        },
        "features": {
            "can_apply": not is_admin,
            "can_track": True,
            "can_manage_applications": is_admin,
            "can_manage_users": "*" in permissions or "manage_users" in permissions,
            "can_manage_roles": user_has_any_role(current_user, "super_admin", "system_admin"),
            "can_view_reports": "*" in permissions or "view_reports" in permissions or "generate_reports" in permissions,
            "can_export": "*" in permissions or "export_data" in permissions
        },
        "localization": {
            "available_locales": _load_available_locales(),
            "default_locale": "en"
        },
        "hierarchy": config_engine.get_hierarchy_data()
    }
    
    # Build navigation based on role
    if not is_admin:
        frontend_config["navigation"]["items"] = [
            {"label": "Dashboard", "path": "/", "icon": "🏠"},
            {"label": "Apply for Service", "path": "/apply", "icon": "📝"},
            {"label": "Track Application", "path": "/track", "icon": "🔍"}
        ]
    else:
        nav_items = [
            {"label": "Dashboard", "path": "/", "icon": "🏠"},
            {"label": "Track Application", "path": "/track", "icon": "🔍"}
        ]
        
        if user_has_any_role(current_user, "super_admin", "system_admin") or "manage_users" in permissions:
            nav_items.append({"label": "User Management", "path": "/admin/users", "icon": "👥"})

        if user_has_any_role(current_user, "super_admin", "system_admin"):
            nav_items.extend([
                {"label": "Role Management", "path": "/admin/roles", "icon": "🎭"},
                {"label": "Services", "path": "/admin/services", "icon": "⚙️"},
                {"label": "Workflows", "path": "/admin/workflows", "icon": "🔄"},
                {"label": "Localizations", "path": "/admin/localizations", "icon": "🌐"}
            ])
        if user_has_any_role(current_user, "verification_officer"):
            nav_items.append({"label": "Verify Applications", "path": "/admin/verify", "icon": "✅"})
        if user_has_any_role(current_user, "document_verifier"):
            nav_items.append({"label": "Document Verification", "path": "/admin/documents", "icon": "📄"})
        if user_has_any_role(current_user, "payment_officer"):
            nav_items.append({"label": "Payment Processing", "path": "/admin/payments", "icon": "💰"})
        if user_has_any_role(current_user, "certificate_issuer"):
            nav_items.append({"label": "Issue Certificates", "path": "/admin/issue", "icon": "📜"})
        
        frontend_config["navigation"]["items"] = nav_items
    
    return frontend_config

@app.get("/api/frontend/localization/locales")
async def get_frontend_locales():
    from .supabase_client import supabase

    locales = _load_available_locales()
    return {"locales": locales}

@app.get("/api/frontend/localization")
async def get_frontend_localization(locale: str = "en"):
    localization = _load_localization_entry(locale)
    if not localization:
        return {"locale": locale, "display_name": locale, "translations": {}}
    return {
        "locale": localization.get("locale", locale),
        "display_name": localization.get("display_name", locale),
        "translations": localization.get("translations", {})
    }

@app.get("/api/frontend/services")
async def get_frontend_services(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get services that this user can see/apply for"""
    
    is_admin = current_user["type"] == "admin"
    
    if is_admin:
        return {
            "can_apply": False,
            "services": [],
            "message": "Admins cannot apply for services. Please login as citizen to apply."
        }
    
    all_services = config_engine.get_all_services()
    
    return {
        "can_apply": True,
        "services": all_services,
        "categories": config_engine.get_categories()
    }


def _require_config_admin(current_user: Dict[str, Any]) -> None:
    if current_user["type"] != "admin" or not user_has_any_role(current_user, "super_admin", "system_admin"):
        raise HTTPException(status_code=403, detail="Configuration admin access required")


@app.post("/api/admin/config/reload")
async def reload_dynamic_config(current_user = Depends(AuthHandler.get_current_user_required)):
    """Reload service, workflow, and role config from the database into memory."""
    _require_config_admin(current_user)
    try:
        config_engine.reload()
        workflow_engine.reload()
        role_manager.reload()
        return {"ok": True, "message": "Engines reloaded from database"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/admin/config/presets/{category}")
async def get_config_presets(category: str, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    import os, json
    base_dir = os.path.join(os.path.dirname(__file__), "..", "config")
    presets = []

    try:
        if category == "services":
            for filename in ["documents.json", "services.json"]:
                filepath = os.path.join(base_dir, filename)
                if os.path.exists(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # documents.json has {"documents": {...}, "services": {...}}
                        keys1 = data.get("documents", {})
                        keys2 = data.get("services", {})
                        keys = {**keys1, **keys2} if isinstance(keys1, dict) and isinstance(keys2, dict) else {}
                        
                        # Handle case where file just has top-level service objects
                        if not keys:
                            for k, v in data.items():
                                if isinstance(v, dict) and "name" in v:
                                    keys[k] = v

                        for key, val in keys.items():
                            presets.append({
                                "id": key,
                                "name": val.get("name", key),
                                "config": val
                            })
        elif category == "workflows":
            filepath = os.path.join(base_dir, "workflows.json")
            if os.path.exists(filepath):
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for key, val in data.get("workflows", {}).items():
                        presets.append({
                            "id": key,
                            "name": val.get("name", key),
                            "config": val
                        })
        elif category == "localizations":
            for filename in os.listdir(base_dir):
                if filename.startswith("localization_") and filename.endswith(".json"):
                    filepath = os.path.join(base_dir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        locale_id = filename.replace("localization_", "").replace(".json", "")
                        presets.append({
                            "id": locale_id,
                            "name": data.get("display_name", locale_id),
                            "config": data.get("translations", {})
                        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"presets": presets}


@app.get("/api/admin/config/services")
async def admin_list_service_definitions(current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    res = supabase.table("service_definitions").select("*").order("service_id").execute()
    return {"services": res.data or []}


@app.put("/api/admin/config/services/{service_id}")
async def admin_upsert_service_definition(
    service_id: str,
    payload: ServiceDefinitionUpsert,
    current_user = Depends(AuthHandler.get_current_user_required),
):
    _require_config_admin(current_user)
    if payload.service_kind not in ("document", "service"):
        raise HTTPException(status_code=400, detail="service_kind must be document or service")
    from .supabase_client import supabase

    now = datetime.now().isoformat()
    row = {
        "service_id": service_id,
        "service_kind": payload.service_kind,
        "config": payload.config,
        "is_active": payload.is_active,
        "updated_at": now,
    }
    supabase.table("service_definitions").upsert(row, on_conflict="service_id").execute()
    config_engine.reload()
    return {"ok": True, "service_id": service_id}


@app.delete("/api/admin/config/services/{service_id}")
async def admin_deactivate_service(service_id: str, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    supabase.table("service_definitions").update({"is_active": False, "updated_at": datetime.now().isoformat()}).eq(
        "service_id", service_id
    ).execute()
    config_engine.reload()
    return {"ok": True}


@app.get("/api/admin/config/workflows")
async def admin_list_workflows(current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    res = supabase.table("workflow_definitions").select("*").order("workflow_name").execute()
    return {"workflows": res.data or []}


@app.put("/api/admin/config/workflows/{workflow_name}")
async def admin_upsert_workflow(
    workflow_name: str,
    payload: WorkflowUpsert,
    current_user = Depends(AuthHandler.get_current_user_required),
):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    row = {
        "workflow_name": workflow_name,
        "definition": payload.definition,
        "is_active": payload.is_active,
        "updated_at": datetime.now().isoformat(),
    }
    supabase.table("workflow_definitions").upsert(row, on_conflict="workflow_name").execute()
    workflow_engine.reload()
    ensure_workflow_roles_exist()
    return {"ok": True, "workflow_name": workflow_name}


@app.get("/api/admin/config/settings/{key}")
async def admin_get_setting(key: str, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    res = supabase.table("app_settings").select("*").eq("key", key).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Setting not found")
    return res.data[0]


@app.put("/api/admin/config/settings/{key}")
async def admin_put_setting(key: str, payload: AppSettingUpsert, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    row = {"key": key, "value": payload.value, "updated_at": datetime.now().isoformat()}
    supabase.table("app_settings").upsert(row, on_conflict="key").execute()
    config_engine.reload()
    workflow_engine.reload()
    role_manager.reload()
    return {"ok": True, "key": key}


@app.get("/api/admin/config/localizations")
async def admin_list_localizations(current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    res = supabase.table("localization_definitions").select("*").order("locale").execute()
    return {"localizations": res.data or []}


@app.get("/api/admin/config/localizations/{locale}")
async def admin_get_localization(locale: str, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    res = supabase.table("localization_definitions").select("*").eq("locale", locale).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Localization not found")
    return res.data[0]


@app.put("/api/admin/config/localizations/{locale}")
async def admin_upsert_localization(locale: str, payload: LocalizationUpsert, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    row = {
        "locale": locale,
        "display_name": payload.display_name or locale,
        "translations": payload.translations,
        "updated_at": datetime.now().isoformat(),
    }
    supabase.table("localization_definitions").upsert(row, on_conflict="locale").execute()
    return {"ok": True, "locale": locale}


@app.delete("/api/admin/config/localizations/{locale}")
async def admin_delete_localization(locale: str, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    from .supabase_client import supabase

    supabase.table("localization_definitions").delete().eq("locale", locale).execute()
    return {"ok": True, "locale": locale}


@app.post("/api/admin/roles")
async def admin_create_role(payload: RoleDefinitionCreate, current_user = Depends(AuthHandler.get_current_user_required)):
    _require_config_admin(current_user)
    role_manager.create_custom_role(
        {
            "role_id": payload.role_name,
            "name": payload.display_name,
            "description": payload.description,
            "permissions": payload.permissions,
            "departments": payload.departments,
            "priority": payload.priority,
            "can_assign_roles": payload.can_assign_roles,
        }
    )
    return {"ok": True, "role": role_manager.get_role_config(payload.role_name)}


@app.put("/api/admin/roles/{role_name}")
async def admin_update_role(
    role_name: str,
    payload: RoleDefinitionUpdate,
    current_user = Depends(AuthHandler.get_current_user_required),
):
    _require_config_admin(current_user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    if not role_manager.update_role_row(role_name, data):
        raise HTTPException(status_code=404, detail="Role not found")
    return {"ok": True, "role": role_manager.get_role_config(role_name)}


# ============ Departments ============

@app.get("/api/admin/departments")
async def get_departments(current_user = Depends(AuthHandler.get_current_user_required)):
    """Get dynamic list of all departments based on roles and configs."""
    _require_config_admin(current_user)
    
    if role_manager._use_db:
        role_manager.reload()
    
    departments = set()
    
    # 1. Add defaults just in case
    defaults = [
        "verification", "document_verification", "payment", 
        "certificate", "audit", "medical", "tax", 
        "income_verification", "view_only"
    ]
    departments.update(defaults)
    
    # 2. Extract from roles
    for role in role_manager.get_all_roles():
        if role.get("departments"):
            for d in role["departments"]:
                if d and d != "all":
                    departments.add(d)
                    
    # 3. Extract from service to department mapping
    mapping = role_manager.config.get("service_to_department_mapping", {})
    for dept in mapping.values():
        if dept and dept != "all":
            departments.add(dept)
            
    # 4. Extract from department to state mapping
    state_mapping = role_manager.config.get("department_to_state_mapping", {})
    for dept in state_mapping.keys():
        if dept and dept != "all":
            departments.add(dept)
            
    # Format for response
    result = []
    for d in sorted(list(departments)):
        label = d.replace("_", " ").title()
        if d == "document_verification":
            label = "Doc Verification"
        result.append({"key": d, "label": label})
    
    return {"departments": result}
        
# ============ Profile Picture Endpoints ============

PROFILE_PICS_BUCKET = os.getenv("MINIO_PROFILE_BUCKET", "profile-pictures")

# Ensure profile pictures bucket exists
if MINIO_AVAILABLE:
    try:
        if not minio_client.bucket_exists(PROFILE_PICS_BUCKET):
            minio_client.make_bucket(PROFILE_PICS_BUCKET)
    except Exception as e:
        print(f"MinIO profile-pictures bucket check failed: {e}")

class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)

@app.put("/api/users/profile")
async def update_user_profile(
    request: UpdateProfileRequest,
    current_user = Depends(AuthHandler.get_current_user_required)
):
    """Update user's profile (name)"""
    from .supabase_client import supabase

    user_id = current_user.get("user_id")
    try:
        supabase.table('users').update({
            'full_name': request.full_name.strip(),
            'updated_at': datetime.now().isoformat()
        }).eq('user_id', user_id).execute()
    except Exception as e:
        print(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile.")

    return {
        "success": True,
        "full_name": request.full_name.strip(),
        "message": "Profile updated successfully"
    }

@app.post("/api/users/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user = Depends(AuthHandler.get_current_user_required)
):
    """Upload or update user's profile picture (MinIO with local fallback)"""
    from .supabase_client import supabase
    import io

    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")

    file_content = await file.read()
    file_size = len(file_content)

    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB.")

    user_id = current_user.get("user_id")
    file_extension = Path(file.filename).suffix if file.filename else '.jpg'
    unique_filename = f"profile_{user_id}_{uuid.uuid4().hex[:8]}{file_extension}"

    if MINIO_AVAILABLE:
        try:
            file_stream = io.BytesIO(file_content)
            minio_client.put_object(
                PROFILE_PICS_BUCKET,
                unique_filename,
                file_stream,
                file_size,
                content_type=file.content_type or 'image/jpeg'
            )
        except Exception as e:
            print(f"MinIO upload failed for profile picture: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload profile picture to storage.")
    else:
        try:
            file_path = os.path.join(LOCAL_UPLOAD_DIR, unique_filename)
            with open(file_path, 'wb') as f:
                f.write(file_content)
        except Exception as e:
            print(f"Local file save failed for profile picture: {e}")
            raise HTTPException(status_code=500, detail="Failed to save profile picture.")

    profile_picture_url = f"/api/uploads/profile-pictures/{unique_filename}"

    try:
        supabase.table('users').update({
            'profile_picture_url': profile_picture_url,
            'updated_at': datetime.now().isoformat()
        }).eq('user_id', user_id).execute()
    except Exception as e:
        print(f"Error updating profile picture URL in database: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile picture.")

    return {
        "success": True,
        "profile_picture_url": profile_picture_url,
        "message": "Profile picture updated successfully"
    }

@app.get("/api/uploads/profile-pictures/{filename}")
async def serve_profile_picture(filename: str):
    """Serve uploaded profile pictures (MinIO with local fallback)"""
    import io

    extension = Path(filename).suffix.lower()
    content_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    content_type = content_types.get(extension, 'image/jpeg')

    if MINIO_AVAILABLE:
        try:
            response = minio_client.get_object(PROFILE_PICS_BUCKET, filename)
            content = response.read()
            response.close()
            response.release_conn()
            return Response(content=content, media_type=content_type)
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise HTTPException(status_code=404, detail="Profile picture not found")
            raise HTTPException(status_code=500, detail="Failed to retrieve profile picture.")
    else:
        file_path = os.path.join(LOCAL_UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Profile picture not found")
        with open(file_path, 'rb') as f:
            content = f.read()
        return Response(content=content, media_type=content_type)



# ============ Health Check ============

@app.get("/api/hierarchy/{level}")
async def get_hierarchy_level(level: str, parent_id: str = None):
    """Get hierarchy data for dropdowns"""
    try:
        data = config_engine.get_hierarchy_data(level, parent_id)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching hierarchy data: {str(e)}")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)