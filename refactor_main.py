import re

file_path = r"c:\Users\raclo\.gemini\antigravity-ide\scratch\porra-mundial-spring\src\main\resources\static\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Replace Firebase imports and presence (Lines 2-84)
# Find 'import { initializeApp }' and '});' that corresponds to onlineUsersRef
api_polling_code = """// REST API INTEGRATION
const API_BASE = '/api';

function fetchApiData() {
  Promise.all([
    fetch(`${API_BASE}/standings`).then(r => r.json()),
    fetch(`${API_BASE}/matches/radar`).then(r => r.json()),
    fetch(`${API_BASE}/bets`).then(r => r.json()),
    fetch(`${API_BASE}/matches`).then(r => r.json())
  ]).then(([standings, radar, bets, matches]) => {
    window.officialPoints = standings || {};
    window.matchRadar = radar || { live: [], last: [], next: [] };
    
    // Process bets
    window.participantsHashes = bets || [];
    const potElement = document.getElementById("prize-pot-rules");
    if (potElement) {
      potElement.innerText = (window.participantsHashes.length * 5) + "€";
    }

    // Process matches to build allGames list
    window.allGames = matches || [];
    
    // Call UI update functions
    if (typeof renderHomeStandings === "function") renderHomeStandings();
    if (typeof renderLeaderboard === "function") renderLeaderboard();
    if (typeof renderLastMatches === "function") renderLastMatches();
    if (typeof renderStats === "function") renderStats();
    if (typeof window.populateMyBetDropdown === "function") window.populateMyBetDropdown();
    
    const headerBtn = document.getElementById('btn-view-my-bet-header');
    if (headerBtn && window.participantsHashes.length > 0) headerBtn.style.display = 'inline-block';
    
    updateOfficialUI();
  }).catch(e => console.error("Error fetching data from API:", e));
}

// Poll every 10 seconds
setInterval(fetchApiData, 10000);
fetchApiData(); // Initial load
"""

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.startswith('import { initializeApp }'):
        skip = True
        new_lines.append(api_polling_code + '\n')
    
    if skip and line.startswith('// State for Leaderboard'):
        skip = False

    if not skip:
        new_lines.append(line)

content = "".join(new_lines)

# 2. Delete onValue calls
content = re.sub(r'onValue\(ref\(database, \'official\'\), \(snapshot\) => \{.*?\}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'onValue\(ref\(database, \'officialPoints\'\), \(snapshot\) => \{.*?\}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'onValue\(ref\(database, \'matches\'\), \(snapshot\) => \{.*?\n\}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'onValue\(ref\(database, \'matchRadar\'\), \(snapshot\) => \{.*?\}\);\n', '', content, flags=re.DOTALL)
content = re.sub(r'onValue\(ref\(database, \'bets\'\), \(snapshot\) => \{.*?\n\}\);\n', '', content, flags=re.DOTALL)

# 3. Replace deleteBet etc
bet_actions = """
window.deleteBet = function (key) {
  if (confirm("¿Estás seguro de que quieres borrar esta apuesta?")) {
    fetch(`${API_BASE}/bets/${key}`, { method: 'DELETE' })
      .then(() => { alert("Apuesta eliminada con éxito."); fetchApiData(); })
      .catch(e => alert("Error al borrar: " + e.message));
  }
};

window.fixThird = function (key, hash, winner) {
  if (!confirm("¿Asignar a " + winner + " como ganador del 3º Puesto para esta apuesta?")) return;
  const part = decodeHash(hash);
  if (!part) return;
  part.thirdPlaceWinner = winner;
  const jsonString = JSON.stringify(part);
  const newHash = btoa(unescape(encodeURIComponent(jsonString)));

  fetch(`${API_BASE}/bets/${key}`, { 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash: newHash }) 
  }).then(() => {
    alert("¡Tercer puesto corregido con éxito!");
    fetchApiData();
  }).catch(e => alert("Error: " + e.message));
};

window.acceptBet = function (key) {
  fetch(`${API_BASE}/bets/${key}/pay`, { method: 'PUT' })
    .then(() => { alert("¡Apuesta confirmada! Ahora contará en la clasificación."); fetchApiData(); })
    .catch(e => alert("Error al confirmar: " + e.message));
};

window.editBetName = function (key, currentHash) {
  const decoded = decodeHash(currentHash);
  if (!decoded) return alert("No se pudo decodificar la apuesta.");

  const newUserName = prompt("Edita el nombre del jugador:", decoded.user || "");
  if (newUserName === null) return;

  const newBetName = prompt("Edita el nombre de la apuesta:", decoded.bet || newUserName);
  if (newBetName === null) return;

  if (newUserName.trim() === "") return alert("El nombre no puede estar vacío");

  decoded.user = newUserName.trim();
  decoded.bet = newBetName.trim();
  const newHash = btoa(unescape(encodeURIComponent(JSON.stringify(decoded))));

  fetch(`${API_BASE}/bets/${key}`, { 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantName: decoded.user, betName: decoded.bet, hash: newHash }) 
  }).then(() => {
    alert("¡Nombre actualizado correctamente!");
    fetchApiData();
  }).catch(e => alert("Error al actualizar: " + e.message));
};
"""
content = re.sub(r'window\.deleteBet = function.*?window\.viewBet = function', bet_actions + '\nwindow.viewBet = function', content, flags=re.DOTALL)

# 4. Remove connectionHistory pushes
content = re.sub(r'push\(ref\(database, \'connectionHistory\'\).*?\);', '', content)
content = re.sub(r'get\(ref\(database, \'connectionHistory\'\)\)\.then\(\(snap\) => \{.*?\n    \}\);', '', content, flags=re.DOTALL)

# 5. manualTiebreakers
content = re.sub(r'set\(ref\(database, \'manualTiebreakers\'\).*?\)', 'console.log("Manual tiebreakers updated locally")', content)
content = re.sub(r'onValue\(ref\(database, \'manualTiebreakers\'\), \(snapshot\) => \{.*?\n\}\);\n', '', content, flags=re.DOTALL)

# 6. Save bet (pushing new bet to database)
save_bet = """
fetch(`${API_BASE}/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantName: document.getElementById("user-name").value.trim(), hash: hash })
    }).then(() => fetchApiData())
"""
content = re.sub(r'push\(ref\(database, \'bets\'\), \{ hash: hash, paid: false \}\)', save_bet, content)

# 7. officialPoints setter (backend does this now)
content = re.sub(r'set\(ref\(database, \'officialPoints\'\), newPoints\)', 'console.log("Points calculated locally")', content)
content = re.sub(r'await set\(ref\(database, \'officialPoints\'\), newPoints\);', '', content)
content = re.sub(r'await set\(ref\(database, \'matchRadar\'\), radar\);', '', content)
content = re.sub(r'await set\(ref\(database, \'matches\'\), cacheData\);', '', content)
content = re.sub(r'set\(ref\(database, \'official\'\), hash\)', 'console.log("Official hash updated locally")', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("main.js refactored with careful limits!")
