import "server-only";

/**
 * Paid plans are switched off unless BILLING_ENABLED is exactly "true".
 * While off (testing and the pilot): everyone has full access to the tutor,
 * revision and exam marking, and no trial banner or plan screens are shown.
 * Turn it on once Paddle is configured (see .env.example).
 */
export function billingEnabled() {
  return process.env.BILLING_ENABLED === "true";
}
