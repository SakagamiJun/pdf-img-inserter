import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  resolvePreferredLocale,
  setDocumentLanguage,
} from "./locale";
import { defaultNS, resources } from "./resources";

const initialLocale = resolvePreferredLocale();

void i18n.use(initReactI18next).init({
  defaultNS,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
  lng: initialLocale,
  ns: [defaultNS],
  react: {
    useSuspense: false,
  },
  resources,
  returnNull: false,
  supportedLngs: Object.keys(resources),
});

setDocumentLanguage(initialLocale);

i18n.on("languageChanged", (language) => {
  const locale = normalizeSupportedLocale(language) ?? DEFAULT_LOCALE;
  setDocumentLanguage(locale);
});

export default i18n;
