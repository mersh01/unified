"""
Database initialization module for setting up Supabase schema on startup.
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import requests

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "http://localhost:54321")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "your-anon-key")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", None)

# Read the SQL initialization script
def get_init_sql():
    """Get the SQL initialization script"""
    sql_path = os.path.join(os.path.dirname(__file__), '..', 'supabase_init.sql')
    try:
        with open(sql_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: supabase_init.sql not found at {sql_path}")
        return None

def check_table_exists():
    """Check if applications table exists"""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        response = supabase.table('applications').select('*').limit(1).execute()
        return True
    except Exception as e:
        return False

def initialize_with_service_key():
    """Initialize database using service role key (has admin privileges)"""
    if not SUPABASE_SERVICE_KEY:
        return False
    
    try:
        sql = get_init_sql()
        if not sql:
            return False
        
        # Use Supabase REST API to execute SQL with service role key
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Split SQL into individual statements and execute each
        statements = [s.strip() for s in sql.split(';') if s.strip()]
        
        for statement in statements:
            # For RPC calls, we need to use Supabase's RPC function
            # or we can try the direct REST endpoint if available
            try:
                response = requests.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/execute_sql",
                    headers=headers,
                    json={"sql": statement}
                )
                if response.status_code not in [200, 201, 204]:
                    print(f"SQL execution warning: {response.status_code} - {response.text}")
            except:
                # If RPC doesn't work, try another approach
                pass
        
        # Verify table was created
        if check_table_exists():
            print("✓ Database schema initialized successfully with service role key")
            return True
        else:
            print("⚠ Schema initialization attempted but table still not detected")
            return False
            
    except Exception as e:
        print(f"Error initializing with service key: {e}")
        return False

def initialize_db():
    """Initialize the database schema"""
    try:
        # First check if table already exists
        if check_table_exists():
            print("✓ Database already initialized - applications table exists")
            return True
        
        print("Applications table not found. Attempting to initialize...")
        
        # Try with service role key first
        if SUPABASE_SERVICE_KEY:
            if initialize_with_service_key():
                return True
        
        # If service key approach failed or not available, show manual instructions
        print("\n" + "="*70)
        print("DATABASE INITIALIZATION REQUIRED")
        print("="*70)
        print("\nThe 'applications' table does not exist in your Supabase database.")
        print("\n📋 Option 1: Use Service Role Key (Recommended)")
        print("-" * 70)
        print("1. Get your service role key from Supabase dashboard:")
        print("   - Go to https://app.supabase.com → your-project")
        print("   - Settings → API → Service Role Secret")
        print("2. Add to your .env file:")
        print("   SUPABASE_SERVICE_KEY=your_service_role_key")
        print("3. Restart the backend - schema will initialize automatically")
        
        print("\n📋 Option 2: Manual Setup")
        print("-" * 70)
        print("1. Go to https://app.supabase.com → your-project")
        print("2. Open SQL Editor → New Query")
        print("3. Copy and paste contents of supabase_init.sql")
        print("4. Click Run")
        print("\n" + "="*70 + "\n")
        
        return False
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        return False

if __name__ == "__main__":
    initialize_db()
