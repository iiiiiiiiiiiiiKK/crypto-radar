import { NavLink } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";

interface NavItem {
  to: string;
  key: string;
  icon: string;
  end?: boolean;
}

const ITEMS: NavItem[] = [
  { to: "/", key: "nav.overview", icon: "◧", end: true },
  { to: "/spot", key: "nav.spot", icon: "◆" },
  { to: "/perp", key: "nav.futures", icon: "⬢" },
  { to: "/alpha", key: "nav.alpha", icon: "◈" },
  { to: "/screener", key: "nav.screener", icon: "⚡" },
  { to: "/watchlists", key: "nav.watchlists", icon: "☆" },
  { to: "/settings", key: "nav.settings", icon: "⚙" },
];

export function MobileNav() {
  const { t } = useI18n();
  return (
    <nav
      className="md:hidden shrink-0 border-t border-line bg-panel flex items-stretch overflow-x-auto"
      aria-label="Primary mobile"
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex-1 min-w-[56px] flex flex-col items-center justify-center gap-0.5 py-1.5 text-2xs ${
              isActive ? "text-accent" : "text-muted"
            }`
          }
        >
          <span className="text-sm leading-none">{item.icon}</span>
          <span className="truncate max-w-full px-1">{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
