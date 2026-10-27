import { NavLink } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { useUiStore } from "@/stores/uiStore";

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
  { to: "/basis", key: "nav.basis", icon: "⇄" },
  { to: "/screener", key: "nav.screener", icon: "⚡" },
  { to: "/alerts", key: "nav.alerts", icon: "◔" },
  { to: "/watchlists", key: "nav.watchlists", icon: "☆" },
  { to: "/settings", key: "nav.settings", icon: "⚙" },
];

export function Sidebar() {
  const { t } = useI18n();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggle = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 border-r border-line bg-panel transition-[width] duration-150 ${
        collapsed ? "w-[52px]" : "w-[168px]"
      }`}
    >
      <div className="h-[46px] flex items-center gap-2 px-3 border-b border-line shrink-0 overflow-hidden">
        <span className="text-accent text-base leading-none shrink-0">◎</span>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-wide truncate">CRYPTO RADAR</div>
            <div className="text-2xs text-faint truncate">{t("appTagline")}</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 py-2 cr-scroll" aria-label="Primary">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={t(item.key)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 h-8 mx-1.5 mb-0.5 px-2 rounded text-xs transition-colors ${
                isActive
                  ? "bg-accent/12 text-accent"
                  : "text-muted hover:text-text hover:bg-panel-2"
              }`
            }
          >
            <span className="w-4 text-center shrink-0">{item.icon}</span>
            {!collapsed ? <span className="truncate">{t(item.key)}</span> : null}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="h-8 border-t border-line text-2xs text-faint hover:text-accent shrink-0"
        onClick={toggle}
        aria-label="Toggle sidebar"
      >
        {collapsed ? "»" : "«"}
      </button>
    </aside>
  );
}
