import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icons";

interface PanelProps {
  /** Module number shown in the header, e.g. "03". */
  id?: string;
  title: string;
  hint?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
  plain?: boolean;
  warn?: boolean;
  bodyClass?: string;
  footer?: ReactNode;
}

/** The console module: sharp frame, numbered header, HUD corner brackets. */
export function Panel({
  id,
  title,
  hint,
  tools,
  children,
  className = "",
  plain = false,
  warn = false,
  bodyClass = "",
  footer,
}: PanelProps) {
  const classes = [
    "panel",
    plain ? "panel--plain" : "",
    warn ? "panel--warn" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <header className="panel__head">
        {id ? <span className="panel__idx">{id}</span> : null}
        <h2 className="panel__title">{title}</h2>
        {hint ? <span className="panel__hint">{hint}</span> : null}
        {tools ? <div className="panel__tools">{tools}</div> : null}
      </header>
      <div className={`panel__body ${bodyClass}`}>{children}</div>
      {footer ? <footer className="panel__foot">{footer}</footer> : null}
    </section>
  );
}

interface SectionTitleProps {
  eyebrow: string;
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ eyebrow, title, desc, actions }: SectionTitleProps) {
  return (
    <div className="page__head">
      <div>
        <div className="page__eyebrow">{eyebrow}</div>
        <h1 className="page__title">{title}</h1>
        {desc ? <p className="page__desc">{desc}</p> : null}
      </div>
      {actions ? <div className="page__head-actions">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon = "radar",
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__glyph">
        <Icon name={icon} size={28} />
      </div>
      <div className="empty__title">{title}</div>
      {text ? <p className="empty__text">{text}</p> : null}
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
  action?: ReactNode;
}) {
  const icon: IconName = tone === "info" ? "info" : "alert";
  return (
    <div className={`notice ${tone === "warn" ? "notice--warn" : tone === "error" ? "notice--error" : ""}`}>
      <span className="notice__icon">
        <Icon name={icon} size={14} />
      </span>
      <div className="grow">{children}</div>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton" style={{ width: `${100 - (index % 3) * 12}%` }} />
      ))}
    </div>
  );
}
