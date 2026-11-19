import { CircleAlert, Clock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { billingConfig } from "@/config/billing";
import { billingEnabled } from "@/server/billing/enabled";
import { getEntitlement } from "@/server/billing/entitlement";

/** Slim notice under the header: last days of the trial, trial over, or a failed payment. */
export async function TrialBanner() {
  if (!billingEnabled()) return null;
  const entitlement = await getEntitlement();
  if (!entitlement) return null;
  const t = await getTranslations("billing");

  let message: string | null = null;
  let urgent = false;
  if (entitlement.subscription?.status === "past_due") {
    message = t("bannerPastDue");
    urgent = true;
  } else if (entitlement.state === "expired") {
    message = t("bannerExpired");
    urgent = true;
  } else if (entitlement.state === "trial" && entitlement.trialDaysLeft <= billingConfig.trialWarningDays) {
    message = t("bannerTrial", { days: entitlement.trialDaysLeft });
  }
  if (!message) return null;

  const Icon = urgent ? CircleAlert : Clock;
  return (
    <div className="border-b bg-sunken">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <Icon className={urgent ? "size-4 shrink-0 text-destructive" : "size-4 shrink-0 text-primary"} aria-hidden="true" />
        <span className="flex-1">{message}</span>
        <Link
          href="/settings#plan"
          className="inline-flex min-h-10 items-center font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("bannerAction")}
        </Link>
      </p>
    </div>
  );
}
