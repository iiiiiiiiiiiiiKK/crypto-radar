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
  { to: "/alpha", key: "nav.alpha", icon: "◈" },
];

const MORE: NavItem[] = [
  { to: "/basis", key: "nav.basis", icon: "⇄" },
  { to: "/screener", key: "nav.screener", icon: "⚡" },
  { to: "/alerts", key: "nav.alerts", icon: "◔" },
  { to: "/watchlists", key: "nav.watchlists", icon: "☆" },
  { to: "/settings", key: "nav.settings", icon: "⚙" },
];

/**
 * Phone navigation: four primary destinations plus a sheet with the rest, so
 * every label stays readable instead of squeezing nine items into one row.
 */
export function MobileNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="md:hidden shrink-0 border-t border-line bg-panel flex items-stretch"
        aria-label="Primary mobile"
      >
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-2xs whitespace-nowrap ${isActive ? "text-accent" : "text-muted"}`
            }
          >
            <span className="text-sm leading-none">{item.icon}</span>
            <span className="px-0.5 leading-tight truncate max-w-full">{t(item.key)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-2xs text-muted"
          data-testid="mobile-more"
          aria-label={t("nav.more")}
        >
          <span className="text-sm leading-none">⋯</span>
          <span className="px-0.5 leading-tight truncate max-w-full">{t("nav.more")}</span>
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
