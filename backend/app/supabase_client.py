from typing import List, Dict, Any
from supabase import create_client, Client
import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:54321")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "your-anon-key")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", None)

# Only use service role key if it is actually configured and not the placeholder text
if SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_KEY != "your_supabase_service_key_here":
    supabase_key = SUPABASE_SERVICE_KEY
else:
    supabase_key = SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, supabase_key)

def create_application(application_data: Dict[str, Any]) -> Dict[str, Any]:
    response = supabase.table('applications').insert(application_data).execute()
    if getattr(response, 'error', None):
        raise RuntimeError(f"Supabase insert error: {response.error}")
    if not getattr(response, 'data', None):
        raise RuntimeError("Supabase insert did not return any data")
    return response.data[0]

def get_application(application_id: str) -> Dict[str, Any]:
    response = supabase.table('applications').select('*').eq('application_id', application_id).execute()
    return response.data[0] if response.data else None

def update_application(application_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
    response = supabase.table('applications').update(update_data).eq('application_id', application_id).execute()
    return response.data[0] if response.data else None

def get_all_applications() -> List[Dict[str, Any]]:
    response = supabase.table('applications').select('*').order('created_at', desc=True).execute()
    return response.data

def get_applications_by_user(user_id: str) -> List[Dict[str, Any]]:
    response = supabase.table('applications').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
    return response.data

def get_applications_by_department(department: str) -> List[Dict[str, Any]]:
    response = supabase.table('applications').select('*').eq('department', department).order('created_at', desc=True).execute()
    return response.data