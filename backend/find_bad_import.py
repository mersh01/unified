#!/usr/bin/env python3
import ast
from pathlib import Path

app_dir = Path('app')

print("Searching for role_manager imports from user_manager...")

for py_file in app_dir.glob('*.py'):
    try:
        with open(py_file, 'r') as f:
            tree = ast.parse(f.read())
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ''
                names = [alias.name for alias in node.names]
                
                # Check if we're importing role_manager from user_manager
                if 'user_manager' in module and 'role_manager' in names:
                    print(f"\n❌ FOUND BAD IMPORT in {py_file.name}:")
                    print(f"   from {module} import role_manager")
                    print(f"   Line: {node.lineno}")
                    
    except Exception as e:
        print(f"Error parsing {py_file}: {e}")

print("\nSearch complete")
