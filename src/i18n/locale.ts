export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-US";
export const LOCALE_STORAGE_KEY = "pdf-img-inserter-locale";

export function normalizeSupportedLocale(
  value: string | null | undefined
): SupportedLocale | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function resolvePreferredLocale(): SupportedLocale {
  if (typeof window !== "undefined") {
    const stored = normalizeSupportedLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  }

  if (typeof navigator !== "undefined") {
    const candidates = navigator.languages.length > 0 ? navigator.languages : [navigator.language];

    for (const candidate of candidates) {
      const locale = normalizeSupportedLocale(candidate);
      if (locale) {
        return locale;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export function setDocumentLanguage(locale: SupportedLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
}
