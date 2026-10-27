import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import { Modal } from "@/components/ui";

interface NavItem {
  to: string;
  key: string;
  icon: string;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: "/", key: "nav.overview", icon: "◧", end: true },
  { to: "/spot", key: "nav.spot", icon: "◆" },
  { to: "/perp", key: "nav.futures", icon: "⬢" },
  { to: "/events", key: "nav.events", icon: "⚡" },
];

const MORE: NavItem[] = [
  { to: "/alpha", key: "nav.alpha", icon: "◈" },
  { to: "/basis", key: "nav.basis", icon: "⇄" },
  { to: "/studio", key: "nav.studio", icon: "✎" },
  { to: "/screener", key: "nav.screener", icon: "◎" },
  { to: "/alerts", key: "nav.alerts", icon: "◔" },
  { to: "/watchlists", key: "nav.watchlists", icon: "☆" },
  { to: "/profile", key: "nav.profile", icon: "☗" },
  { to: "/settings", key: "nav.settings", icon: "⚙" },
];

/**
 * Phone navigation.
 *
 * A pixel HUD bar with four destinations and a sheet for the rest. The bar
 * respects the iPhone home indicator area so the last list row is never
 * covered by it — the shell reserves this height.
 */
export function MobileNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="md:hidden shrink-0 bg-panel border-t border-line flex items-stretch safe-bottom"
        aria-label="Primary mobile"
        data-testid="mobile-nav"
      >
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 ${isActive ? "text-accent" : "text-muted"}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-accent" />
                ) : null}
                <span className="text-[15px] leading-none">{item.icon}</span>
                <span className="font-pixel text-[10px] leading-tight tracking-wider truncate max-w-full px-0.5">
                  {t(item.key)}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-muted"
          data-testid="mobile-more"
          aria-label={t("nav.more")}
        >
          <span className="text-[15px] leading-none">⋯</span>
          <span className="font-pixel text-[10px] leading-tight tracking-wider truncate max-w-full px-0.5">
            {t("nav.more")}
          </span>
        </button>
      </nav>

      <Modal open={moreOpen} title={t("nav.more")} onClose={() => setMoreOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {MORE.map((item) => (
            <button
              key={item.to}
              type="button"
              className="cr-panel-2 flex flex-col items-center justify-center gap-1 py-3 text-2xs text-text active:bg-panel-3"
              onClick={() => {
                setMoreOpen(false);
                navigate(item.to);
              }}
              data-testid={`more-${item.key.split(".")[1]}`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-center leading-tight">{t(item.key)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
