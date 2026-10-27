import type { ArenaBoardId } from "./boards";

/** Order of the arena tabs. Kept separate so the component only exports UI. */
export const ARENA_TABS: ArenaBoardId[] = [
  "gainers",
  "losers",
  "volume",
  "spike",
  "funding",
  "watchlist",
];
