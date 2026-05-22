import requests
import json
import time

BASE_URL = "http://localhost:8000"
SUPERADMIN = {"username": "admin", "password": "admin123"} 

def test_scoped_admins():
    suffix = str(int(time.time()))
    oromia_admin_username = f"oromia_admin_{suffix}"
    oromia_user_username = f"oromia_user_{suffix}"
    amhara_user_username = f"amhara_user_{suffix}"
    sinana_admin_username = f"sinana_admin_{suffix}"

    print("Logging in as superadmin...")
    res = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"username": SUPERADMIN["username"], "password": SUPERADMIN["password"]})
    if res.status_code != 200:
        print("Failed to login as superadmin:", res.text)
        return
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("Creating custom regional admin role...")
    role_data = {
        "role_name": "regional_admin",
        "display_name": "Regional Admin",
        "description": "Admin for a specific region",
        "permissions": ["manage_users"],
        "is_system_role": False
    }
    # ignore if already exists
    requests.post(f"{BASE_URL}/api/admin/roles", json=role_data, headers=headers)

    print(f"Creating a regional admin user ({oromia_admin_username})...")
    reg_admin = {
        "username": oromia_admin_username,
        "full_name": "Oromia Admin",
        "email": f"oromia_{suffix}@example.com",
        "phone_number": f"0911000{suffix[-3:]}",
        "role": "regional_admin",
        "department": "all",
        "hierarchy_country": "ETH",
        "hierarchy_region": "oromia",
        "hierarchy_zone": "",
        "hierarchy_woreda": "",
        "hierarchy_kebele": "",
        "password": "password123"
    }
    res = requests.post(f"{BASE_URL}/api/admin/users", json=reg_admin, headers=headers)
    if res.status_code != 201:
        print("Failed to create regional admin user:", res.text)
        return
    
    print(f"Logging in as Oromia Admin ({oromia_admin_username})...")
    res = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"username": oromia_admin_username, "password": "password123"})
    if res.status_code != 200:
        print("Failed to login as reg admin:", res.text)
        return
    reg_token = res.json()["token"]
    reg_headers = {"Authorization": f"Bearer {reg_token}"}
    
    print(f"Oromia Admin attempting to create a user in Amhara region ({amhara_user_username}) (should fail)...")
    bad_user = {
        "username": amhara_user_username,
        "full_name": "Amhara User",
        "phone_number": f"0912000{suffix[-3:]}",
        "role": "citizen",
        "hierarchy_country": "ETH",
        "hierarchy_region": "amhara"
    }
    res = requests.post(f"{BASE_URL}/api/admin/users", json=bad_user, headers=reg_headers)
    print(f"Status: {res.status_code}, Response: {res.text}")

    print(f"Oromia Admin attempting to create a user in Oromia region ({oromia_user_username}) (should succeed)...")
    good_user = {
        "username": oromia_user_username,
        "full_name": "Oromia User",
        "phone_number": f"0913000{suffix[-3:]}",
        "role": "citizen",
        "hierarchy_country": "ETH",
        "hierarchy_region": "oromia"
    }
    res = requests.post(f"{BASE_URL}/api/admin/users", json=good_user, headers=reg_headers)
    print(f"Status: {res.status_code}, Response: {res.text}")

    print(f"Creating a Woreda level admin user (Oromia / Arsii / Sinana - {sinana_admin_username})...")
    woreda_admin = {
        "username": sinana_admin_username,
        "full_name": "Sinana Woreda Admin",
        "email": f"sinana_{suffix}@example.com",
        "phone_number": f"0914000{suffix[-3:]}",
        "role": "regional_admin",
        "department": "all",
        "hierarchy_country": "ETH",
        "hierarchy_region": "oromia",
        "hierarchy_zone": "arsii",
        "hierarchy_woreda": "sinana",
        "hierarchy_kebele": "",
        "password": "password123"
    }
    res = requests.post(f"{BASE_URL}/api/admin/users", json=woreda_admin, headers=headers)
    print(f"Woreda admin created status: {res.status_code}")

    print(f"Logging in as Sinana Woreda Admin ({sinana_admin_username})...")
    res = requests.post(f"{BASE_URL}/api/auth/admin-login", json={"username": sinana_admin_username, "password": "password123"})
    if res.status_code != 200:
        print("Failed to login as Sinana Woreda Admin:", res.text)
        return
    woreda_token = res.json()["token"]
    woreda_headers = {"Authorization": f"Bearer {woreda_token}"}

    print(f"Sinana Woreda Admin fetching users list (should NOT contain the higher-level Oromia Admin {oromia_admin_username})...")
    res = requests.get(f"{BASE_URL}/api/admin/users", headers=woreda_headers)
    if res.status_code == 200:
        users = res.json().get("users", [])
        usernames = [u.get("username") for u in users]
        print("Usernames visible to Sinana Woreda Admin:", usernames)
        if oromia_admin_username in usernames:
            print("❌ FAILURE: Woreda admin can see higher-level Region admin!")
        else:
            print("✅ SUCCESS: Woreda admin cannot see higher-level Region admin.")
    else:
        print("Failed to fetch users list:", res.status_code, res.text)

if __name__ == "__main__":
    test_scoped_admins()
