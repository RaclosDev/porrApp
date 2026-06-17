import json
import urllib.request
import time

url = "https://porra.raclos.es/api/presence/cleanup"

users_to_delete = [
    "victor",
    "Peric",
    "Perico",
    "Alberto Alonso",
    "L",
    "anonomio",
    "Anónimo",
    "LaManoDeDios"
]

print(f"Enviando solicitud de borrado para: {users_to_delete}")

req = urllib.request.Request(url, method="POST", data=json.dumps(users_to_delete).encode('utf-8'))
req.add_header('Content-Type', 'application/json')

max_retries = 10
for i in range(max_retries):
    try:
        with urllib.request.urlopen(req) as res:
            response_text = res.read().decode('utf-8')
            print("Success:", response_text)
            break
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Error 404: Endpoint not found yet (Attempt {i+1}/{max_retries}). Waiting 5 seconds...")
            time.sleep(5)
        else:
            print("HTTP Error during cleanup:", e)
            if hasattr(e, 'read'):
                print(e.read().decode())
            break
    except Exception as e:
        print("Error during cleanup:", e)
        time.sleep(5)
