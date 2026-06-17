import json
import urllib.request
import urllib.parse
from datetime import datetime

# URL of the new migration endpoint in production
migration_url = "https://porra.raclos.es/api/presence/migrate"

# Load the downloaded Firebase connectionHistory
with open('connectionHistory.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

if not data:
    print("No data found to migrate.")
    exit(0)

# Format into List<ConnectionLog> payload
payload = []
for key, value in data.items():
    name = value.get("name", "Anónimo")
    time_str = value.get("time")
    
    # Validation: time_str should look like "2026-06-14T23:07:40.779Z"
    if time_str:
        payload.append({
            "participantName": name,
            "connectedAt": time_str
        })

print(f"Preparing to send {len(payload)} connection logs to {migration_url}...")

# Send payload
req = urllib.request.Request(migration_url, method="POST", data=json.dumps(payload).encode('utf-8'))
req.add_header('Content-Type', 'application/json')

try:
    with urllib.request.urlopen(req) as res:
        response_text = res.read().decode('utf-8')
        print("Success:", response_text)
except Exception as e:
    print("Error during migration:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
