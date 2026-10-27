import { Link } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { useNow } from "@/hooks/useTimers";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { ConnectionPill } from "./ConnectionPill";
import { GlobalSearch } from "./GlobalSearch";

export function TopBar() {
  const now = useNow(1000);
  const setHotkeysOpen = useUi((state) => state.setHotkeysOpen);
  const motion = usePreferences((state) => state.motion);

  const local = new Date(now).toLocaleTimeString("en-GB", { hour12: false });
  const utc = new Date(now).toISOString().slice(11, 19);

  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Crypto Radar 首页">
        <div>
          <div className="brand__word">
            <span>CRYPTO</span>
            <span>RADAR</span>
          </div>
          <div className="brand__sub">Meme-Powered Market Command Center</div>
        </div>
        <span className="brand__ver">V2.0</span>
      </Link>

      <GlobalSearch />

      <div className="topbar__right">
        <ConnectionPill />
        <div className="clock" title={`本地时间 ${local} · UTC ${utc}`}>
          <span className="clock__t">{local}</span>
          <span className="clock__z">UTC {utc} · CST</span>
        </div>
        <button
          type="button"
          className="btn btn--icon btn--ghost"
          title="快捷键说明 (?)"
          aria-label="快捷键说明"
          onClick={() => setHotkeysOpen(true)}
        >
          <Icon name="keyboard" size={16} />
        </button>
        <Link
          to="/settings"
          className="btn btn--icon btn--ghost"
          title={`设置 · 动效：${motion === "calm" ? "已减弱" : "完整"}`}
          aria-label="设置"
        >
          <Icon name="settings" size={16} />
        </Link>
      </div>
    </header>
  );
}
