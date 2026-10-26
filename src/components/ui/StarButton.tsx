export function StarButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`w-6 h-6 inline-flex items-center justify-center rounded text-xs transition-colors ${
        active ? "text-accent" : "text-faint hover:text-accent/70"
      }`}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
