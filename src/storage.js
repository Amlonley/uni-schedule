export function getWindowStorage(win = window) {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}