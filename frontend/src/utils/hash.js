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

