import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from '../locales/en/common.json';
import translationMR from '../locales/mr/common.json';
import translationHI from '../locales/hi/common.json';

const resources = {
  en: {
    common: translationEN,
    translation: translationEN,
  },
  mr: {
    common: translationMR,
    translation: translationMR,
  },
  hi: {
    common: translationHI,
    translation: translationHI,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ns: ['common', 'translation'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes values to prevent XSS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
