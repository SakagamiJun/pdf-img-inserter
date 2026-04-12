import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeSupportedLocale,
  resolvePreferredLocale,
  type SupportedLocale,
} from "@/i18n/locale";

export function useLocale() {
  const { i18n } = useTranslation();
  const locale =
    normalizeSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      }

      void i18n.changeLanguage(next);
    },
    [i18n]
  );

  return { locale, setLocale };
}

export { resolvePreferredLocale, type SupportedLocale };
