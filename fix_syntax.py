import re

file_path = r"c:\Users\raclo\.gemini\antigravity-ide\scratch\porra-mundial-spring\src\main\resources\static\main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the broken window.viewHistoryStats entirely up to window.openMatchPlayer
# Since it might be mangled, let's look for "window.viewHistoryStats = function" and anything until "window.openMatchPlayer"
regex = re.compile(r'window\.viewHistoryStats = function \(\) \{.*?(?=window\.openMatchPlayer = function)', re.DOTALL)

clean_func = """window.viewHistoryStats = function () {
  const listEl = document.getElementById('history-stats-list');
  if (listEl) listEl.innerHTML = '<p style="text-align:center; color: #aaa;">El historial de conexiones no está disponible en la versión local.</p>';
};

"""
content = regex.sub(clean_func, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed viewHistoryStats!")
