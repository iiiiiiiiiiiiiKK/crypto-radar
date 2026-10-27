import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { SocketRow } from "./ConnectionPill";
import { NAV_ITEMS } from "./nav";

export function RailNav() {
  const location = useLocation();

  return (
    <nav className="rail" aria-label="主导航">
      <div className="rail__logo" aria-hidden="true">
        <BrandGlyph size={30} />
      </div>

      <div className="rail__nav">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="rail__item"
              data-active={active}
              title={`${item.cn} · ${item.label}`}
              aria-label={item.cn}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={17} />
              <span className="rail__txt">{item.cn}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="rail__foot">
        <div className="rail__sock">
          <SocketRow market="spot" />
          <SocketRow market="futures" />
          <SocketRow market="alpha" />
        </div>
        <NavLink
          to="/settings"
          className="rail__item"
          data-active={location.pathname.startsWith("/settings")}
          title="设置"
          aria-label="设置"
          style={{ width: 44 }}
        >
          <Icon name="settings" size={16} />
        </NavLink>
      </div>
    </nav>
  );
}

export function BrandGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="var(--line-3)" strokeWidth="1">
        <circle cx="22" cy="22" r="17" />
        <circle cx="22" cy="22" r="11" opacity="0.7" />
        <circle cx="22" cy="22" r="5" opacity="0.5" />
      </g>
      <g className="brandmark__sweep" style={{ transformOrigin: "22px 22px" }}>
        <path d="M22 22 L22 6 A16 16 0 0 1 36 14 Z" fill="rgba(0,245,160,0.22)" />
      </g>
      <path d="M22 22 L34 10" stroke="var(--up)" strokeWidth="1.6" />
      <circle cx="31" cy="13" r="2" fill="var(--amber)" />
      <circle cx="14" cy="29" r="1.5" fill="var(--down)" />
      <circle cx="26" cy="31" r="1.2" fill="var(--blue)" />
      <circle cx="22" cy="22" r="2" fill="var(--up)" />
    </svg>
  );
}
