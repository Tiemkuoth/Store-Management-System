const APP_CACHE_KEY = 'sms_app_cache_v1';

export function loadAppCache() {
  try {
    const raw = localStorage.getItem(APP_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Failed to load app cache:', error?.message || error);
    return {};
  }
}

export function saveAppCache(data) {
  try {
    localStorage.setItem(APP_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save app cache:', error?.message || error);
  }
}

export function mergeAppCache(partial) {
  try {
    const existing = loadAppCache();
    localStorage.setItem(APP_CACHE_KEY, JSON.stringify({ ...existing, ...partial }));
  } catch (error) {
    console.warn('Failed to merge app cache:', error?.message || error);
  }
}

export function clearAppCache() {
  try {
    localStorage.removeItem(APP_CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear app cache:', error?.message || error);
  }
}
