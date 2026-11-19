/** Paid plans. Prices live in Paddle; this file holds what the app needs to know. */
export const billingConfig = {
  /** Days of full access every new account gets. */
  trialDays: 14,
  /** Show the trial banner when this many days (or fewer) are left. */
  trialWarningDays: 5,
  /** Parent links stop working after this many days. */
  inviteDays: 7,
  /** Bump when the terms change, so consents record which text was agreed to. */
  termsVersion: "2026-10-01",
  plans: ["monthly", "yearly"] as const,
};

export type Plan = (typeof billingConfig.plans)[number];
