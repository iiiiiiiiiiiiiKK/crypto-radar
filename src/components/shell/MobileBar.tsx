import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "@/components/Icons";

const ITEMS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/", label: "作战室", icon: "command" },
  { to: "/markets", label: "行情", icon: "markets" },
  { to: "/radar", label: "雷达", icon: "waves" },
  { to: "/charts", label: "K线", icon: "chart" },
  { to: "/watchlist", label: "自选", icon: "star" },
];

export function MobileBar() {
  const location = useLocation();
  return (
    <nav className="mobilebar" aria-label="移动端导航">
      {ITEMS.map((item) => {
        const active =
          item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
        return (
          <NavLink key={item.to} to={item.to} className="mobilebar__item" data-active={active}>
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
