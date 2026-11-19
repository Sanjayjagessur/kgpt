import { CreditCard } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { billingEnabled } from "@/server/billing/enabled";
import { getEntitlement } from "@/server/billing/entitlement";
import { ParentLink } from "./parent-link";

/** Settings → Plan: what the student has now, and a link for a parent when they need a plan. */
export async function PlanSection() {
  if (!billingEnabled()) return null;
  const entitlement = await getEntitlement();
  if (!entitlement) return null;
  const [t, format] = await Promise.all([getTranslations("billing"), getFormatter()]);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });

  const { state, subscription } = entitlement;
  const plan = subscription?.plan ? t(`plans.${subscription.plan}`) : "";
  let status: string;
  if (subscription?.status === "past_due") status = t("statusPastDue");
  else if (state === "active" && subscription?.cancel_at) status = t("statusEnding", { plan, date: date(subscription.cancel_at) });
  else if (state === "active" && subscription?.current_period_end)
    status = t("statusActive", { plan, date: date(subscription.current_period_end) });
  else if (state === "active") status = t("statusActiveNoDate", { plan });
  else if (state === "trial") status = t("statusTrial", { days: entitlement.trialDaysLeft, date: date(entitlement.trialEndsAt) });
  else status = t("statusExpired");

  return (
    <section id="plan" aria-labelledby="plan-title" className="mt-10 scroll-mt-24 rounded-xl border p-5">
      <h2 id="plan-title" className="flex items-center gap-2 text-xl font-bold">
        <CreditCard className="size-5 text-primary" aria-hidden="true" />
        {t("planTitle")}
      </h2>
      <p className="mt-2 font-semibold">{status}</p>
      {state !== "active" && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t("planBody")}</p>
          <div className="mt-4">
            <ParentLink />
          </div>
        </>
      )}
    </section>
  );
}
