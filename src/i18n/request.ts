import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isUiLocale, siteConfig, type UiLocale } from "@/config/site";

/**
 * Locale resolution without locale-prefixed URLs:
 * cookie (kept in sync with the profile) → Accept-Language → default.
 */
async function resolveLocale(): Promise<UiLocale> {
  const store = await cookies();
  const fromCookie = store.get(siteConfig.localeCookie)?.value;
  if (isUiLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isUiLocale(tag)) return tag;
  }
  return siteConfig.defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: "Indian/Mauritius",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
