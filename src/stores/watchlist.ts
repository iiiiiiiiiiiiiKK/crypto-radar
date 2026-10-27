import { create } from "zustand";
import { persist } from "zustand/middleware";
import { engine } from "@/engine/engine";
import type { MarketId } from "@/types/market";
import { createId } from "@/lib/storage";

export interface WatchItem {
  key: string;
  market: MarketId;
  symbol: string;
  addedAt: number;
}

export interface WatchGroup {
  id: string;
  name: string;
  items: WatchItem[];
}

interface WatchlistState {
  groups: WatchGroup[];
  activeGroupId: string;
  add: (item: { key: string; market: MarketId; symbol: string }) => void;
  remove: (key: string) => void;
  toggle: (item: { key: string; market: MarketId; symbol: string }) => void;
  reorder: (groupId: string, from: number, to: number) => void;
  createGroup: (name: string) => string;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  setActiveGroup: (id: string) => void;
  clear: () => void;
}

const DEFAULT_GROUP: WatchGroup = { id: "default", name: "主观察室", items: [] };

function syncEngine(groups: WatchGroup[]): void {
  const keys: string[] = [];
  for (const group of groups) for (const item of group.items) keys.push(item.key);
  engine.store.setWatchKeys(keys);
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      groups: [DEFAULT_GROUP],
      activeGroupId: DEFAULT_GROUP.id,

      add: (item) => {
        const exists = get().groups.some((group) =>
          group.items.some((entry) => entry.key === item.key),
        );
        if (exists) return;
        const groups = get().groups.map((group) =>
          group.id === get().activeGroupId
            ? { ...group, items: [...group.items, { ...item, addedAt: Date.now() }] }
            : group,
        );
        set({ groups });
        syncEngine(groups);
      },

      remove: (key) => {
        const groups = get().groups.map((group) => ({
          ...group,
          items: group.items.filter((item) => item.key !== key),
        }));
        set({ groups });
        syncEngine(groups);
      },

      toggle: (item) => {
        const has = get().groups.some((group) => group.items.some((entry) => entry.key === item.key));
        if (has) get().remove(item.key);
        else get().add(item);
      },

      reorder: (groupId, from, to) => {
        const groups = get().groups.map((group) => {
          if (group.id !== groupId) return group;
          const items = [...group.items];
          if (from < 0 || from >= items.length || to < 0 || to >= items.length) return group;
          const [moved] = items.splice(from, 1);
          items.splice(to, 0, moved);
          return { ...group, items };
        });
        set({ groups });
      },

      createGroup: (name) => {
        const id = createId("grp");
        set((state) => ({ groups: [...state.groups, { id, name, items: [] }], activeGroupId: id }));
        return id;
      },

      renameGroup: (id, name) =>
        set((state) => ({
          groups: state.groups.map((group) => (group.id === id ? { ...group, name } : group)),
        })),

      deleteGroup: (id) => {
        const groups = get().groups.filter((group) => group.id !== id);
        if (groups.length === 0) {
          set({ groups: [DEFAULT_GROUP], activeGroupId: DEFAULT_GROUP.id });
          syncEngine([DEFAULT_GROUP]);
          return;
        }
        set({
          groups,
          activeGroupId: get().activeGroupId === id ? groups[0].id : get().activeGroupId,
        });
        syncEngine(groups);
      },

      setActiveGroup: (activeGroupId) => set({ activeGroupId }),

      clear: () => {
        set({ groups: [DEFAULT_GROUP], activeGroupId: DEFAULT_GROUP.id });
        syncEngine([DEFAULT_GROUP]);
      },
    }),
    {
      name: "crypto-radar:v2:watchlist",
      version: 2,
      onRehydrateStorage: () => (state) => {
        if (state) syncEngine(state.groups);
      },
    },
  ),
);

/** Every watched key across every group. */
export function watchKeysOf(groups: WatchGroup[]): Set<string> {
  const keys = new Set<string>();
  for (const group of groups) for (const item of group.items) keys.add(item.key);
  return keys;
}

export function useWatchKeys(): Set<string> {
  const groups = useWatchlist((state) => state.groups);
  return watchKeysOf(groups);
}
