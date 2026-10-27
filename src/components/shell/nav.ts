import type { IconName } from "@/components/Icons";

export interface NavItem {
  to: string;
  label: string;
  cn: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "COMMAND", cn: "作战室", icon: "command" },
  { to: "/markets", label: "MARKETS", cn: "行情", icon: "markets" },
  { to: "/radar", label: "RADAR", cn: "异动", icon: "waves" },
  { to: "/charts", label: "CHARTS", cn: "K 线", icon: "chart" },
  { to: "/studio", label: "STUDIO", cn: "Meme", icon: "sparkles" },
  { to: "/watchlist", label: "WATCH", cn: "自选", icon: "star" },
];
