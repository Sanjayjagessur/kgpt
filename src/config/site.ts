export const siteConfig = {
  name: "myKPT",
  /** Locales the interface is available in. */
  uiLocales: ["en", "fr", "mfe"] as const,
  /** Languages the tutor can answer in. */
  tutorLocales: ["en", "fr", "mfe"] as const,
  defaultLocale: "en" as const,
  localeCookie: "NEXT_LOCALE",
};

export type UiLocale = (typeof siteConfig.uiLocales)[number];
export type TutorLocale = (typeof siteConfig.tutorLocales)[number];

export function isUiLocale(value: string | undefined | null): value is UiLocale {
  return !!value && (siteConfig.uiLocales as readonly string[]).includes(value);
}
