
/**
 * Deterministic safety helpers that work without any AI call.
 * They back up the AI classifier and never replace it. Pure functions with no
 * secrets, so they can also run in the browser (e.g. to warn before sending).
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Phone numbers, written so that numbers in maths and science are left alone:
// - "+" international numbers ("+230 5765 4321", "+33 6 12 34 56 78"), only when "+" is not part of a sum;
// - "00 230" Mauritian international prefix;
// - Mauritian mobiles: 8 digits starting with 5 ("5123 4567", "51234567");
// - landlines only in the usual 3-4 grouping ("212 3456", "212-3456"), never as a bare 7-digit number.
// Thousands groups ("1 002 345 678"), decimals and constants (6.02 × 10^23) never match.
const PHONE =
  /(?<![\d.,+\-×*/=(]\s?)(?:\+\d{1,3}|00\s?230)[\s.-]?\d[\d\s.-]{5,14}\d(?!\d|[.,]\d)|(?<![\d.,+\-×*/=(]\s?)(?:5\d{3}[\s.-]?\d{4}|[2-9]\d{2}[\s-]\d{4})(?!\d|[.,]\d|\s\d)/g;
// Mauritian National Identity Card: letter, 12 digits, letter/digit (14 characters).
const NIC = /\b[A-Za-z]\d{12}[A-Za-z0-9]\b/g;

export type Redaction = { text: string; redacted: boolean };

/**
 * Removes contact details and identity numbers before a message is stored or sent to the AI.
 * `marker` is the localised placeholder, e.g. "[removed for your safety]".
 */
export function redactPersonalData(text: string, marker: string): Redaction {
  let redacted = false;
  const swap = () => {
    redacted = true;
    return marker;
  };
  const out = text.replace(EMAIL, swap).replace(NIC, swap).replace(PHONE, swap);
  return { text: out, redacted };
}

// Clear self-harm phrases in English, French and Kreol Morisien. Used only when the
// AI classifier is unavailable, so a failure never lets a student in crisis go unanswered.
const SELF_HARM = [
  /\b(kill|hurt|harm|cut)\s+(my\s*self|myself)\b/i,
  /\b(suicide|suicidal)\b/i,
  /\bend\s+(my|it\s+all)\s*(life)?\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive)\b/i,
  /\bme\s+(suicider|tuer)\b/i,
  /\b(envie|envi)\s+de\s+mourir\b/i,
  /\bme\s+faire\s+du\s+mal\b/i,
  /\bsuicid(e|er)\b/i,
  /\btouy\s+(mo\s+lekor|momem)\b/i,
  /\banvi\s+mor\b/i,
  /\bfer\s+mwa\s+dimal\b/i,
];

/** Local fallback screen. Returns "self_harm" on a clear match, otherwise null. */
export function localSelfHarmScreen(text: string): "self_harm" | null {
  return SELF_HARM.some((re) => re.test(text)) ? "self_harm" : null;
}

/** Platform-only markup the tutor trusts. Removed from student text so it can't be forged. */
const RESERVED_TAGS = /<\s*\/?\s*(syllabus_context|extract)\b[^>]*>/gi;

export function stripReservedTags(text: string): string {
  return text.replace(RESERVED_TAGS, "");
}
