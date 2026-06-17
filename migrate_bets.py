import urllib.request
import json
import base64
import urllib.parse

firebase_url = "https://porra-mundial-2026-6d233-default-rtdb.europe-west1.firebasedatabase.app/bets.json"
spring_url = "https://porra.raclos.es/api/bets"

print("Fetching from Firebase...")
try:
    with urllib.request.urlopen(firebase_url) as response:
        data = json.loads(response.read().decode())
        print(f"Fetched {len(data) if data else 0} bets from Firebase.")
except Exception as e:
    print("Error fetching from Firebase:", e)
    exit(1)

if not data:
    print("No data to migrate.")
    exit(0)

success = 0
for key, value in data.items():
    if isinstance(value, str):
        hash_val = value
        paid = True
    else:
        hash_val = value.get("hash", "")
        paid = value.get("paid", True)

    # Decode hash to get participantName and betName
    participant_name = "Migrated User"
    bet_name = "Migrated Bet"
    
    try:
        decoded_json = urllib.parse.unquote(base64.b64decode(hash_val).decode('utf-8'))
        bet_data = json.loads(decoded_json)
        participant_name = bet_data.get('user', participant_name)
        bet_name = bet_data.get('bet', bet_name)
    except Exception as e:
        print(f"Could not decode hash for {key}: {e}")

    payload = {
        "participantName": participant_name,
        "betName": bet_name,
        "hash": hash_val
    }
    
    req = urllib.request.Request(spring_url, method="POST", data=json.dumps(payload).encode('utf-8'))
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode())
            new_id = response_data.get("id")
            
            # If it was paid in firebase, let's mark it as paid in Spring Boot
            if paid:
                pay_req = urllib.request.Request(f"{spring_url}/{new_id}/pay", method="PUT")
                urllib.request.urlopen(pay_req)
                
            success += 1
            print(f"Migrated {participant_name} ({key})")
    except Exception as e:
        print(f"Error migrating {key}: {e}")

print(f"Migration completed: {success} bets successfully copied to Spring Boot H2.")
