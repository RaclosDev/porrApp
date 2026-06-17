export function decodeHash(hash) {
  try {
    const jsonString = decodeURIComponent(escape(atob(hash)));
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
}

export function encodeHash(stateObj) {
  try {
    const jsonString = JSON.stringify(stateObj);
    return btoa(unescape(encodeURIComponent(jsonString)));
  } catch (e) {
    return null;
  }
}

export function checkAdmin(str) {
  if (!str) return false;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash === 1517890930;
}
