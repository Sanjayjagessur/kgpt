import type { SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";

/**
 * One small geometric illustration per subject, drawn in the subject colour
 * (currentColor) with layered opacity so it works in light and dark themes.
 * Decorative only: always aria-hidden.
 */
const ART: Record<SubjectId, React.ReactNode> = {
  "art-design": (
    <>
      <circle cx="58" cy="52" r="30" opacity=".18" />
      <path d="M92 20c14 6 24 20 22 36-2 14-16 16-22 8-5-7-14-2-18 4-6 9-22 4-20-12 2-20 20-42 38-36z" opacity=".55" />
      <circle cx="84" cy="36" r="4.5" fill="var(--card)" />
      <circle cx="98" cy="44" r="4.5" fill="var(--card)" />
      <path d="M40 86 70 44" strokeWidth="6" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  biology: (
    <>
      <ellipse cx="80" cy="52" rx="48" ry="32" opacity=".16" />
      <path d="M54 76c0-30 20-50 52-54-2 32-22 52-52 54z" opacity=".6" />
      <path d="M56 74 96 32" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="44" cy="34" r="9" opacity=".35" />
      <circle cx="44" cy="34" r="3.5" />
    </>
  ),
  business: (
    <>
      <rect x="34" y="56" width="16" height="26" rx="4" opacity=".3" />
      <rect x="58" y="42" width="16" height="40" rx="4" opacity=".5" />
      <rect x="82" y="28" width="16" height="54" rx="4" opacity=".75" />
      <path d="M32 44 58 28l22 8 32-20" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="112" cy="16" r="6" />
    </>
  ),
  chemistry: (
    <>
      <path d="M66 18h28M72 18v22L50 78c-3 5 1 10 6 10h48c5 0 9-5 6-10L88 40V18" stroke="currentColor" strokeWidth="4" fill="none" strokeLinejoin="round" />
      <path d="M58 66h44l8 13c2 4-1 7-5 7H55c-4 0-7-3-5-7z" opacity=".5" />
      <circle cx="74" cy="72" r="4" fill="var(--card)" />
      <circle cx="88" cy="78" r="3" fill="var(--card)" />
      <circle cx="116" cy="30" r="8" opacity=".25" />
    </>
  ),
  "design-technology": (
    <>
      <circle cx="68" cy="50" r="26" opacity=".2" />
      <path d="M68 28a22 22 0 1 0 0 44 22 22 0 0 0 0-44zm0 14a8 8 0 1 1 0 16 8 8 0 0 1 0-16z" opacity=".6" />
      <rect x="92" y="22" width="12" height="60" rx="3" transform="rotate(30 98 52)" opacity=".85" />
      <path d="M40 84h80" stroke="currentColor" strokeWidth="3" strokeDasharray="4 6" />
    </>
  ),
  drama: (
    <>
      <path d="M36 26h40v22c0 14-9 24-20 24S36 62 36 48z" opacity=".55" />
      <path d="M78 36h42v22c0 14-9 24-21 24s-21-10-21-24z" opacity=".85" />
      <circle cx="49" cy="40" r="3.5" fill="var(--card)" />
      <circle cx="63" cy="40" r="3.5" fill="var(--card)" />
      <path d="M48 56q8-6 16 0" stroke="var(--card)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M90 64q9 6 18 0" stroke="var(--card)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  english: (
    <>
      <path d="M30 26c14-4 28-2 48 8v52c-20-10-34-12-48-8z" opacity=".35" />
      <path d="M130 26c-14-4-28-2-52 8v52c24-10 38-12 52-8z" opacity=".65" />
      <path d="M92 46h26M92 56h26M92 66h18" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  "english-literature": (
    <>
      <rect x="40" y="20" width="18" height="66" rx="3" opacity=".35" />
      <rect x="62" y="28" width="16" height="58" rx="3" opacity=".6" />
      <rect x="82" y="16" width="20" height="70" rx="3" transform="rotate(12 92 51)" opacity=".85" />
      <path d="M118 22c6 10 6 22 0 32" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  "food-textiles": (
    <>
      <circle cx="62" cy="54" r="30" opacity=".2" />
      <circle cx="62" cy="54" r="20" opacity=".45" />
      <path d="M100 24c18 10 18 50 0 60" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M100 30 124 76" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="62" cy="54" r="6" />
    </>
  ),
  french: (
    <>
      <path d="M26 28h58a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H50l-14 12V70h-2a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" opacity=".45" />
      <path d="M134 40H88a8 8 0 0 0-8 8v22a8 8 0 0 0 8 8h24l12 10V78h2a8 8 0 0 0 8-8V48a8 8 0 0 0-8-8z" opacity=".8" />
      <path d="M98 54h24M98 64h14" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  "french-literature": (
    <>
      <path d="M44 18h54l18 18v50H44z" opacity=".3" />
      <path d="M98 18v18h18" opacity=".6" />
      <path d="M56 46h40M56 56h46M56 66h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M118 70 136 30l6 4-14 40z" />
    </>
  ),
  ict: (
    <>
      <rect x="30" y="22" width="100" height="58" rx="8" opacity=".25" />
      <rect x="38" y="30" width="84" height="42" rx="4" opacity=".5" />
      <path d="m58 42-10 9 10 9M102 42l10 9-10 9M86 38l-12 28" stroke="var(--card)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="62" y="84" width="36" height="6" rx="3" />
    </>
  ),
  "kreol-morisien": (
    <>
      {/* island silhouette over lagoon rings */}
      <ellipse cx="80" cy="56" rx="52" ry="28" opacity=".16" />
      <ellipse cx="80" cy="56" rx="36" ry="19" opacity=".28" />
      <path d="M66 44c8-10 22-10 28-2 6 7 4 18-6 22-10 4-26 2-28-6-1-5 2-10 6-14z" opacity=".85" />
      <path d="M86 40l4-12 4 10" opacity=".85" />
    </>
  ),
  "life-skills": (
    <>
      <circle cx="80" cy="50" r="32" opacity=".16" />
      <path d="M80 80S48 62 48 42a16 16 0 0 1 32-4 16 16 0 0 1 32 4c0 20-32 38-32 38z" opacity=".7" />
      <path d="M64 46h10l5-8 6 16 5-8h8" stroke="var(--card)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  mathematics: (
    <>
      <path d="M30 84 76 18l46 66z" opacity=".22" />
      <circle cx="104" cy="40" r="22" opacity=".5" />
      <rect x="36" y="46" width="34" height="34" rx="4" opacity=".75" />
      <path d="M46 63h14M53 56v14" stroke="var(--card)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M96 40h16" stroke="var(--card)" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  "physical-education": (
    <>
      <circle cx="96" cy="50" r="28" opacity=".6" />
      <path d="M72 38c14 6 34 6 48 0M72 62c14-6 34-6 48 0M96 22v56" stroke="var(--card)" strokeWidth="3" fill="none" />
      <path d="M22 70h30M28 58h24M34 46h18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".45" />
    </>
  ),
  physics: (
    <>
      <ellipse cx="80" cy="50" rx="46" ry="16" stroke="currentColor" strokeWidth="3" fill="none" opacity=".45" />
      <ellipse cx="80" cy="50" rx="46" ry="16" stroke="currentColor" strokeWidth="3" fill="none" opacity=".7" transform="rotate(60 80 50)" />
      <ellipse cx="80" cy="50" rx="46" ry="16" stroke="currentColor" strokeWidth="3" fill="none" opacity=".7" transform="rotate(-60 80 50)" />
      <circle cx="80" cy="50" r="9" />
      <circle cx="124" cy="44" r="4.5" />
    </>
  ),
  "sexuality-education": (
    <>
      <circle cx="64" cy="50" r="26" opacity=".35" />
      <circle cx="96" cy="50" r="26" opacity=".55" />
      <path d="M80 30a26 26 0 0 1 0 40 26 26 0 0 1 0-40z" opacity=".9" />
    </>
  ),
  "social-modern-studies": (
    <>
      <circle cx="80" cy="50" r="34" opacity=".22" />
      <path d="M80 16a34 34 0 0 1 0 68M80 16a34 34 0 0 0 0 68M46 50h68" stroke="currentColor" strokeWidth="3" fill="none" opacity=".7" />
      <path d="M70 26c10 6 4 16-4 18s-8 12 0 18" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="104" cy="30" r="6" />
    </>
  ),
};

export function SubjectArt({ subject, className }: { subject: SubjectId; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 100"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("text-subject", className)}
    >
      {ART[subject]}
    </svg>
  );
}
