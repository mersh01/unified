#!/usr/bin/env python
"""Upload localization files to Supabase database"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

print(f"Connecting to Supabase: {SUPABASE_URL}")
print(f"Service Key present: {bool(SUPABASE_SERVICE_KEY)}")

# Create client with service key
client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Get the config directory
config_dir = Path(__file__).parent / "config"
print(f"Config directory: {config_dir}")

# Upload English localization
en_file = config_dir / "localization_en.json"
print(f"English file exists: {en_file.exists()}")
if en_file.exists():
    with open(en_file, 'r', encoding='utf-8') as f:
        en_translations = json.load(f)
    
    en_data = {
        "locale": "en",
        "display_name": "English",
        "translations": en_translations
    }
    
    result = client.table("localization_definitions").upsert(en_data, on_conflict="locale").execute()
    print(f"✓ English localization uploaded")
    print(f"  Result: {result.data}")
else:
    print(f"✗ English file not found at {en_file}")

# Upload Amharic localization
am_file = config_dir / "localization_am.json"
print(f"Amharic file exists: {am_file.exists()}")
if am_file.exists():
    with open(am_file, 'r', encoding='utf-8') as f:
        am_translations = json.load(f)
    
    am_data = {
        "locale": "am",
        "display_name": "Amharic",
        "translations": am_translations
    }
    
    result = client.table("localization_definitions").upsert(am_data, on_conflict="locale").execute()
    print(f"✓ Amharic localization uploaded")
    print(f"  Result: {result.data}")
else:
    print(f"✗ Amharic file not found at {am_file}")

print("\nLocalizations upload complete!")

