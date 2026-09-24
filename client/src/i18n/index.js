import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import am from './locales/am/translation.json';
import enAuth from './locales/en/auth.json';
import amAuth from './locales/am/auth.json';
import enLayout from './locales/en/layout.json';
import amLayout from './locales/am/layout.json';
import enShared from './locales/en/shared.json';
import amShared from './locales/am/shared.json';
import enSettings from './locales/en/settings.json';
import amSettings from './locales/am/settings.json';
import enTemplates from './locales/en/templates.json';
import amTemplates from './locales/am/templates.json';
import enDelivery from './locales/en/delivery.json';
import amDelivery from './locales/am/delivery.json';

const STORAGE_KEY = 'docu-vault-language';

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'am' || saved === 'en') return saved;
  } catch (e) {}
  const browserLang = (navigator.language || 'en').toLowerCase();
  return browserLang.startsWith('am') ? 'am' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en, auth: enAuth, layout: enLayout, shared: enShared, settings: enSettings, templates: enTemplates, delivery: enDelivery },
    am: { translation: am, auth: amAuth, layout: amLayout, shared: amShared, settings: amSettings, templates: amTemplates, delivery: amDelivery },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
    nsMode: 'fallback',
  },
});

export function setAppLanguage(lang) {
  if (lang !== 'en' && lang !== 'am') return;
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {}
}

export function syncHtmlLanguage() {
  const lang = i18n.language === 'am' ? 'am' : 'en';
  document.documentElement.setAttribute('lang', lang);
  document.body.classList.toggle('lang-am', lang === 'am');
}

i18n.on('languageChanged', () => syncHtmlLanguage());
syncHtmlLanguage();

export default i18n;