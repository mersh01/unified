import os

frontend_dir = r"c:\indivitual\document-system-fullstack\frontend"
target_string = "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';"
replacement_string = "const API_URL = import.meta.env.VITE_API_URL || 'https://unified-211c.vercel.app';"

count = 0
for root, dirs, files in os.walk(frontend_dir):
    # Skip node_modules and dist
    if "node_modules" in root or "dist" in root:
        continue
    for file in files:
        if file.endswith((".js", ".jsx")):
            file_path = os.path.join(root, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            if target_string in content:
                new_content = content.replace(target_string, replacement_string)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated fallback for: {file}")
                count += 1

print(f"Total files updated: {count}")
