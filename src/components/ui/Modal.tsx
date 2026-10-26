import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 420,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative cr-panel bg-panel shadow-2xl animate-fade-in w-full max-h-[80vh] overflow-hidden flex flex-col"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-3 h-9 border-b border-line shrink-0">
          <h2 className="text-xs font-medium text-text">{title}</h2>
          <button type="button" className="cr-btn cr-btn-icon" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className="p-3 overflow-y-auto cr-scroll">{children}</div>
      </div>
    </div>
  );
}
