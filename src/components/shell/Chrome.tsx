import { Icon } from "@/components/Icons";
import { Modal } from "@/components/ui/Controls";
import { HOTKEYS } from "@/hooks/useHotkeys";
import { useToasts, useUi } from "@/stores/ui";

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id} data-tone={toast.tone}>
          <Icon name={toast.tone === "warn" ? "alert" : "info"} size={14} />
          <div className="grow">
            <div style={{ color: "var(--ink)", fontSize: 12 }}>{toast.title}</div>
            {toast.text ? <div style={{ fontSize: 11, marginTop: 2 }}>{toast.text}</div> : null}
          </div>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            aria-label="关闭提示"
            onClick={() => dismiss(toast.id)}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function HotkeySheet() {
  const open = useUi((state) => state.hotkeysOpen);
  const setOpen = useUi((state) => state.setHotkeysOpen);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="快捷键 / SHORTCUTS">
      <div className="hotkeys">
        {HOTKEYS.map((item) => (
          <div className="hotkeys__row" key={item.keys}>
            <span>{item.label}</span>
            <kbd>{item.keys}</kbd>
          </div>
        ))}
      </div>
      <p className="dim" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        在输入框、文本域或可编辑区域中输入时，全局快捷键不会触发。数字键 1/2/3 直接切换市场，F 收藏当前交易对。
      </p>
    </Modal>
  );
}
