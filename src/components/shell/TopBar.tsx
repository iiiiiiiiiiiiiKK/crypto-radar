import { Link } from "react-router-dom";
import { Icon } from "@/components/Icons";
import { useNow } from "@/hooks/useTimers";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { ConnectionPill } from "./ConnectionPill";
import { GlobalSearch } from "./GlobalSearch";

/** The author's X profile, shown in the top bar of every page. */
export const AUTHOR_X_URL = "https://x.com/0xkillcoin";
export const AUTHOR_X_HANDLE = "@0xkillcoin";

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
        <a
          className="social"
          href={AUTHOR_X_URL}
          target="_blank"
          rel="me noopener noreferrer"
          title={`作者 X：${AUTHOR_X_HANDLE}`}
          aria-label={`在 X 上关注作者 ${AUTHOR_X_HANDLE}`}
          data-testid="author-x"
        >
          <span className="social__glyph" aria-hidden="true">
            𝕏
          </span>
          <span className="social__handle">{AUTHOR_X_HANDLE}</span>
        </a>
        <button
          type="button"
          className="btn btn--icon btn--ghost topbar__hotkeys"
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
