import re

file_path = r"c:\Users\raclo\.gemini\antigravity-ide\scratch\porra-mundial-spring\src\main\resources\static\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix window.showConnectionHistory
regex_show = re.compile(r'window\.showConnectionHistory = function\(\) \{.*?(?=window\.viewHistoryStats = function)', re.DOTALL)
clean_show = """window.showConnectionHistory = function() {
  const modal = document.getElementById('connection-history-modal');
  const listEl = document.getElementById('connection-history-list');
  if (!modal || !listEl) return;
  listEl.innerHTML = '<p style="text-align:center; color: #aaa;">Historial no disponible localmente.</p>';
  modal.style.display = 'flex';
};

"""
content = regex_show.sub(clean_show, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed showConnectionHistory!")
