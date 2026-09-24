import { BookOpen, ChartNoAxesColumnIncreasing, Layers, MessagesSquare, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: "/learn" | "/chat" | "/revision" | "/progress";
  key: "learning" | "chat" | "revision" | "progress";
  icon: LucideIcon;
};

/** Primary sections (top nav on desktop). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/learn", key: "learning", icon: BookOpen },
  { href: "/chat", key: "chat", icon: MessagesSquare },
  { href: "/revision", key: "revision", icon: Layers },
];

/** Bottom tab bar on phones adds Progress for thumb reach. */
export const MOBILE_NAV: NavItem[] = [
  ...PRIMARY_NAV,
  { href: "/progress", key: "progress", icon: ChartNoAxesColumnIncreasing },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
