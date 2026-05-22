with open(r"c:\indivitual\document-system-fullstack\backend\app\main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "/api/admin/dashboard/stats" in line or "/api/admin/dashboard/department" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 20 lines after
        for j in range(1, 40):
            if i + j < len(lines):
                print(f"  Line {i+1+j}: {lines[i+j].strip()}")
        print("-" * 50)
