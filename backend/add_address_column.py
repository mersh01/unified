import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import os
import requests

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    print("Please set it and run again, or run the SQL manually in Supabase dashboard:")
    print("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);")
    sys.exit(1)

# Execute SQL via Supabase REST API
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

sql = "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);"

try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": sql}
    )
    
    if response.status_code in [200, 201, 204]:
        print("✓ Address column added successfully to users table")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        print("\nPlease run the SQL manually in Supabase dashboard:")
        print("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);")
        
except Exception as e:
    print(f"Error: {e}")
    print("\nPlease run the SQL manually in Supabase dashboard:")
    print("ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);")
