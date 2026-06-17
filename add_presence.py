import urllib.request
import json
import base64

file_path = r"c:\Users\raclo\.gemini\antigravity-ide\scratch\porra-mundial-spring\src\main\resources\static\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add heartbeat polling logic after fetchApiData
heartbeat_code = """
function sendPresenceHeartbeat() {
  const name = document.getElementById("user-name") ? document.getElementById("user-name").value : "Anónimo";
  if (!name) return;
  fetch(`${API_BASE}/presence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  }).catch(() => {});
}

function fetchPresence() {
  fetch(`${API_BASE}/presence`)
    .then(r => r.json())
    .then(names => {
      const counterEl = document.getElementById('online-counter');
      const textEl = document.getElementById('online-counter-text');
      const listEl = document.getElementById('online-users-list');
      
      if (!counterEl || !textEl || !listEl) return;
      
      const count = names.length;
      textEl.innerText = `👁️ ${count} online`;
      counterEl.style.display = count > 0 ? 'inline-block' : 'none';
      listEl.innerHTML = names.map(n => `<li>${n}</li>`).join("");
      
      // Toggle logic
      counterEl.onclick = function (e) {
        e.stopPropagation();
        counterEl.classList.toggle('show-tooltip');
      };
    }).catch(() => {});
}

setInterval(() => {
  sendPresenceHeartbeat();
  fetchPresence();
}, 5000);
setTimeout(() => {
  sendPresenceHeartbeat();
  fetchPresence();
}, 1000);
"""

if "sendPresenceHeartbeat" not in content:
    content = content.replace("setInterval(fetchApiData, 10000);", heartbeat_code + "\nsetInterval(fetchApiData, 10000);")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added presence script to main.js!")
