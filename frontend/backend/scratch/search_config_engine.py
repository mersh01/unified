with open(r"c:\indivitual\document-system-fullstack\backend\app\main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "config_engine" in line or "workflows" in line or "workflows.json" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 5 lines around
        for j in range(-2, 3):
            if 0 <= i + j < len(lines) and j != 0:
                print(f"  Line {i+1+j}: {lines[i+j].strip()}")
        print("-" * 50)
