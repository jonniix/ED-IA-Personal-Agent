import it from './locales/it.json';

const translations = { it };
let currentLang = 'it';

export function t(key) {
  return translations[currentLang][key] || key;
}
