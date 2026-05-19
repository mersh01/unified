import os
import sys
import json
from fastapi.testclient import TestClient

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from app.main import app
    client = TestClient(app)
    
    # First, let's login as admin to get a token
    login_response = client.post("/api/token", data={
        "username": "admin",
        "password": "admin123"
    })
    
    if login_response.status_code != 200:
        print("Login failed:", login_response.text)
        sys.exit(1)
        
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a complaint application directly via POST /api/applications (citizen)
    submit_response = client.post("/api/applications", headers=headers, json={
        "service_type": "complaint_submission",
        "form_data": {
            "title": "Test Complaint",
            "description": "This is a test complaint to verify the workflow fix."
        }
    })
    
    if submit_response.status_code != 200:
        print("Failed to submit complaint:", submit_response.text)
        sys.exit(1)
        
    app_id = submit_response.json()["application_id"]
    print(f"Created application: {app_id}")
    
    # Try to fetch available actions (this should not crash now!)
    actions_response = client.get(f"/api/applications/{app_id}/available-actions", headers=headers)
    print("Available actions:", actions_response.json())
    
    # Attempt to assign the complaint to LME
    assign_response = client.put(f"/api/applications/{app_id}/status", headers=headers, json={
        "action": "ASSIGN_TO_LME",
        "comment": "Assigning to LME for resolution",
        "assign_to": "admin",
        "user_id": "admin"
    })
    
    if assign_response.status_code == 200:
        print("SUCCESS! Successfully performed the action.")
        print(assign_response.json())
    else:
        print(f"FAILED! Status: {assign_response.status_code}")
        print(assign_response.text)

except Exception as e:
    import traceback
    traceback.print_exc()
