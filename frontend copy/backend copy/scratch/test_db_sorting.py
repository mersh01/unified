from app.supabase_client import get_all_applications
import json

try:
    apps = get_all_applications()
    print(f"Total applications retrieved: {len(apps)}")
    for i, app in enumerate(apps[:10]):
        print(f"[{i+1}] ID: {app.get('application_id')}, Created At: {app.get('created_at')}, Status: {app.get('current_state')}")
except Exception as e:
    print(f"Error querying applications: {e}")
