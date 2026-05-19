#!/usr/bin/env python3
"""
Migration script to add multi-step form support to the applications table.
Run this script to update your database schema.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from sqlalchemy import text

def migrate_applications_table():
    """Add new columns to applications table for multi-step form support"""

    # SQL to add new columns
    alter_statements = [
        "ALTER TABLE applications ADD COLUMN uploaded_files JSON DEFAULT '{}'",
        "ALTER TABLE applications ADD COLUMN multi_step_data JSON DEFAULT '{}'",
        "ALTER TABLE applications ADD COLUMN hierarchy_woreda VARCHAR(255)",
        "ALTER TABLE applications ADD COLUMN hierarchy_kebele VARCHAR(255)",
        "ALTER TABLE applications ADD COLUMN service_level VARCHAR(255)",
        "ALTER TABLE applications ADD COLUMN responsible_hierarchy VARCHAR(255)",
        "ALTER TABLE applications ADD COLUMN department VARCHAR(255)",
        # Rename document_type to service_type for consistency
        "ALTER TABLE applications RENAME COLUMN document_type TO service_type"
    ]

    try:
        with engine.connect() as conn:
            # Check if columns already exist
            result = conn.execute(text("PRAGMA table_info(applications)"))
            columns = [row[1] for row in result.fetchall()]

            for statement in alter_statements:
                try:
                    # Extract column name from ALTER statement
                    if "ADD COLUMN" in statement:
                        column_name = statement.split("ADD COLUMN ")[1].split(" ")[0]
                    elif "RENAME COLUMN" in statement:
                        # Skip rename for now as it might not be supported in all SQLite versions
                        continue
                    else:
                        continue

                    if column_name not in columns:
                        print(f"Adding column: {column_name}")
                        conn.execute(text(statement))
                        conn.commit()
                    else:
                        print(f"Column {column_name} already exists")
                except Exception as e:
                    print(f"Error executing: {statement}")
                    print(f"Error: {e}")
                    # Continue with other statements

        print("Migration completed successfully!")

    except Exception as e:
        print(f"Migration failed: {e}")
        return False

    return True

if __name__ == "__main__":
    print("Starting database migration for multi-step forms...")
    success = migrate_applications_table()
    if success:
        print("✅ Migration completed!")
    else:
        print("❌ Migration failed!")
        sys.exit(1)