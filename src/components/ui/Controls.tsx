import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icons";
import { useWatchlist } from "@/stores/watchlist";
import type { MarketId } from "@/types/market";

export function Seg<T extends string>({
  value,
  options,
  onChange,
  tone = "green",
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  tone?: "green" | "blue" | "violet";
  ariaLabel?: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className="seg__btn"
          data-active={value === option.value}
          data-tone={tone}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel ?? label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track">
        <span className="switch__dot" />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn--icon btn--ghost ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

export function StarButton({
  market,
  symbol,
  label,
}: {
  market: MarketId;
  symbol: string;
  label?: string;
}) {
  const key = `${market}:${symbol}`;
  const groups = useWatchlist((state) => state.groups);
  const toggle = useWatchlist((state) => state.toggle);
  const watched = groups.some((group) => group.items.some((item) => item.key === key));

  return (
    <button
      type="button"
      className="star"
      data-on={watched}
      aria-pressed={watched}
      aria-label={watched ? `取消收藏 ${symbol}` : `收藏 ${symbol}`}
      title={label ?? (watched ? "取消收藏" : "加入自选")}
      onClick={(event) => {
        event.stopPropagation();
        toggle({ key, market, symbol });
      }}
    >
      <Icon name={watched ? "star-filled" : "star"} size={13} />
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const scrim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal__scrim"
      ref={scrim}
      onMouseDown={(event) => {
        if (event.target === scrim.current) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" style={width ? { width } : undefined}>
        <header className="modal__head">
          <div className="modal__title grow">{title}</div>
          <IconButton icon="close" label="关闭" onClick={onClose} />
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint dim">{hint}</span> : null}
    </label>
  );
}
