"""
One-time migration: create the notifications table in Supabase.
Run from the backend/ directory:  python migrate_notifications.py

Uses the Supabase Management API (requires SUPABASE_PROJECT_REF and SUPABASE_SERVICE_KEY).
The project ref is the subdomain in your Supabase URL: https://<ref>.supabase.co
"""
import os, re, sys, requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY    = os.getenv("SUPABASE_ANON_KEY", "")

KEY = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY

# Extract project ref from URL  e.g. nbgbbbhznnfyhznwoarp
match = re.search(r"https://([^.]+)\.supabase\.co", SUPABASE_URL)
PROJECT_REF = match.group(1) if match else None

# ── 1. Check if table already exists ──────────────────────────────────────────
from supabase import create_client
supabase = create_client(SUPABASE_URL, KEY)

try:
    supabase.table("notifications").select("id").limit(1).execute()
    print("✅  notifications table already exists — nothing to do.")
    sys.exit(0)
except Exception:
    pass  # table doesn't exist, continue

DDL = """
CREATE TABLE IF NOT EXISTS notifications (
    id                     SERIAL PRIMARY KEY,
    user_id                VARCHAR NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title                  VARCHAR NOT NULL,
    message                TEXT    NOT NULL,
    type                   VARCHAR NOT NULL,
    related_application_id VARCHAR,
    is_read                BOOLEAN DEFAULT FALSE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
"""

# ── 2. Try Supabase Management API ────────────────────────────────────────────
applied = False
if PROJECT_REF and SUPABASE_SERVICE_KEY:
    mgmt_url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
    }
    try:
        r = requests.post(mgmt_url, headers=headers, json={"query": DDL}, timeout=20)
        if r.status_code in (200, 201):
            print("✅  DDL applied via Management API!")
            applied = True
        else:
            print(f"  ⚠  Management API returned {r.status_code}: {r.text[:300]}")
    except Exception as e:
        print(f"  ⚠  Management API call failed: {e}")

# ── 3. Verify ─────────────────────────────────────────────────────────────────
if applied:
    try:
        supabase.table("notifications").select("id").limit(1).execute()
        print("✅  notifications table verified and ready!")
        sys.exit(0)
    except Exception as e:
        print(f"  ⚠  Could not verify table after creation: {e}")

# ── 4. Manual fallback ────────────────────────────────────────────────────────
print("""
╔══════════════════════════════════════════════════════════════════╗
║   MANUAL STEP REQUIRED — Run this SQL in Supabase SQL Editor    ║
╚══════════════════════════════════════════════════════════════════╝

1. Open https://supabase.com/dashboard → your project
2. Click "SQL Editor" → "New query"
3. Paste and run the SQL below:

----------------------------------------------------------------------""")
print(DDL)
print("----------------------------------------------------------------------")
print("\nAfter running the SQL, restart the backend — notifications will work.")
