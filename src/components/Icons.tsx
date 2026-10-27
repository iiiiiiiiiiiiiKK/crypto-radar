import type { SVGProps } from "react";

export type IconName =
  | "radar"
  | "command"
  | "markets"
  | "waves"
  | "chart"
  | "sparkles"
  | "star"
  | "star-filled"
  | "settings"
  | "search"
  | "close"
  | "refresh"
  | "chevron-down"
  | "chevron-up"
  | "chevron-right"
  | "arrow-up"
  | "arrow-down"
  | "external"
  | "expand"
  | "play"
  | "pause"
  | "trash"
  | "plus"
  | "download"
  | "copy"
  | "link"
  | "grip"
  | "info"
  | "alert"
  | "wifi"
  | "clock"
  | "check"
  | "filter"
  | "columns"
  | "keyboard"
  | "phone"
  | "shuffle";

const PATHS: Record<IconName, JSX.Element> = {
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 19 6" />
      <circle cx="17" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  command: (
    <>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="M12 8.5v7M8.6 10.2h6.8" />
    </>
  ),
  markets: (
    <>
      <path d="M4 19h16" />
      <path d="M7 19V9M12 19V5M17 19v-7" />
    </>
  ),
  waves: (
    <>
      <path d="M3 12h3.5l2-5 3 10 2.5-7 2 4H21" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 14V9M11 16V7M14 13V8M17 17V6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 10.9 10.1 9 12 3.5Z" />
      <path d="M18.5 16.5 19.3 18.7 21.5 19.5 19.3 20.3 18.5 22.5 17.7 20.3 15.5 19.5 17.7 18.7Z" />
    </>
  ),
  star: <path d="M12 4.2l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 4.2Z" />,
  "star-filled": (
    <path
      d="M12 4.2l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 4.2Z"
      fill="currentColor"
    />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.7-6" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  "chevron-up": <path d="M6 14.5l6-6 6 6" />,
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-7.5 7.5" />
      <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />,
  play: <path d="M8 5.5l11 6.5-11 6.5v-13Z" />,
  pause: <path d="M9 5.5v13M15 5.5v13" />,
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 12.5h9L17.5 7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 11l4.5 4.5L16.5 11" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <path d="M15 9V4H4v11h5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.8" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.6-1.6" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 8v.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 16.5v.5" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.5 9a13 13 0 0 1 17 0" />
      <path d="M6.7 12.4a8.5 8.5 0 0 1 10.6 0" />
      <path d="M9.8 15.8a4 4 0 0 1 4.4 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  filter: <path d="M4 6h16l-6 7v6l-4-2v-4L4 6Z" />,
  columns: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1" />
      <path d="M10 5v14M15 5v14" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
      <path d="M7 10.5h.5M11 10.5h.5M15 10.5h.5M7.5 14h9" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="1.5" />
      <path d="M11 17.5h2" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h3.5l9 10H20" />
      <path d="M4 17h3.5l9-10H20" />
      <path d="M17 4.5 20 7l-3 2.5M17 14.5 20 17l-3 2.5" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
