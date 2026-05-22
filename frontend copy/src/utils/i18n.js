export function translate(translations, key, fallback) {
  if (!translations || typeof key !== 'string') {
    return fallback || key;
  }
  return translations[key] || fallback || key;
}

export function getStoredLocale() {
  return localStorage.getItem('locale') || 'en';
}

export function saveLocale(locale) {
  localStorage.setItem('locale', locale);
}
