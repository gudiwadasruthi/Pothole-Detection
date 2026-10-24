import os
import sys
from fastapi.testclient import TestClient
from api.app import app

client = TestClient(app)

print("--- 1. Test unauthorized profile access ---")
res_no_auth = client.get('/api/profile')
print('No auth status (expected 401):', res_no_auth.status_code)
assert res_no_auth.status_code == 401

print("--- 2. Test authorized citizen profile GET & PUT ---")
citizen_headers = {'X-User-Id': 'usr_priya_1', 'X-User-Role': 'user'}

res_profile = client.get('/api/profile', headers=citizen_headers)
print('Citizen profile GET status:', res_profile.status_code)
assert res_profile.status_code == 200

# Attempt privilege escalation: try to pass role='admin'
res_update = client.put(
    '/api/profile',
    headers=citizen_headers,
    json={'name': 'Priya Sharma Updated', 'phone': '+91 98765 00000', 'role': 'admin'}
)
print('Citizen profile PUT status:', res_update.status_code)
assert res_update.status_code == 200
profile_data = res_update.json().get('profile', {})
print('Citizen role after attempted privilege escalation (must stay user):', profile_data.get('role'))
assert profile_data.get('role') == 'user'
assert profile_data.get('name') == 'Priya Sharma Updated'
assert profile_data.get('phone') == '+91 98765 00000'

print("--- 3. Test contractor profile access ---")
contractor_headers = {'X-User-Id': 'CON1', 'X-User-Role': 'contractor'}
res_c_profile = client.get('/api/profile', headers=contractor_headers)
print('Contractor profile GET status:', res_c_profile.status_code)
assert res_c_profile.status_code == 200

# Contractor updating allowed contact fields + attempting role escalation
res_c_update = client.put(
    '/api/profile',
    headers=contractor_headers,
    json={'contact_person': 'Rajesh Kumar Updated', 'phone': '+91 98765 43210', 'service_area': 'Central Zone Expanded', 'role': 'admin'}
)
print('Contractor PUT status:', res_c_update.status_code)
assert res_c_update.status_code == 200
c_profile = res_c_update.json().get('profile', {})
print('Contractor role after escalation attempt (must stay contractor):', c_profile.get('role'))
assert c_profile.get('role') == 'contractor'
assert c_profile.get('contact_person') == 'Rajesh Kumar Updated'
assert c_profile.get('service_area') == 'Central Zone Expanded'

print("--- 4. Test contractor profile read-only endpoint for admin vs citizen ---")
admin_headers = {'X-User-Id': 'ADM1', 'X-User-Role': 'admin'}
res_admin_view_c = client.get('/api/contractors/CON1', headers=admin_headers)
print('Admin view contractor profile status (expected 200):', res_admin_view_c.status_code)
assert res_admin_view_c.status_code == 200
assert res_admin_view_c.json().get('contractor', {}).get('name') == 'Rajesh Constructions'

# Citizen trying to view contractor private profile via /api/contractors/{id}
res_citizen_view_c = client.get('/api/contractors/CON1', headers=citizen_headers)
print('Citizen view contractor profile status (expected 403 Forbidden):', res_citizen_view_c.status_code)
assert res_citizen_view_c.status_code == 403

# Another contractor trying to inspect competitor CON1
competitor_headers = {'X-User-Id': 'CON2', 'X-User-Role': 'contractor'}
res_comp_view_c = client.get('/api/contractors/CON1', headers=competitor_headers)
print('Competitor contractor view profile status (expected 403 Forbidden):', res_comp_view_c.status_code)
assert res_comp_view_c.status_code == 403

print("\n>>> ALL BACKEND RBAC TESTS PASSED SUCCESSFULLY! <<<")
