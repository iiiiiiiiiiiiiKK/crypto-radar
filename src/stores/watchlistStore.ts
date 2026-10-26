import { create } from "zustand";
import {
  defaultWatchlists,
  loadWatchlists,
  makeEntry,
  saveWatchlists,
  type Watchlist,
  type WatchlistEntry,
} from "@/services/storage/watchlists";

interface WatchlistState {
  lists: Watchlist[];
  activeListId: string | null;
  createList: (name: string) => string;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  reorderLists: (from: number, to: number) => void;
  setActiveList: (id: string | null) => void;
  addEntry: (listId: string, entry: WatchlistEntry) => boolean;
  removeEntry: (listId: string, key: string) => void;
  moveEntry: (fromListId: string, toListId: string, key: string) => boolean;
  isWatched: (key: string) => boolean;
  listsForMarket: (market: string) => Watchlist[];
  reset: () => void;
}

const initial = loadWatchlists();

function persist(lists: Watchlist[]): void {
  saveWatchlists(lists);
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  lists: initial,
  activeListId: initial[0]?.id ?? null,
  createList: (name) => {
    const id = `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const list: Watchlist = { id, name: name.trim() || "新列表", entries: [], createdAt: Date.now() };
    set((state) => {
      const lists = [...state.lists, list];
      persist(lists);
      return { lists, activeListId: id };
    });
    return id;
  },
  renameList: (id, name) => {
    set((state) => {
      const lists = state.lists.map((list) =>
        list.id === id ? { ...list, name: name.trim() || list.name } : list,
      );
      persist(lists);
      return { lists };
    });
  },
  deleteList: (id) => {
    set((state) => {
      const lists = state.lists.filter((list) => list.id !== id);
      const finalLists = lists.length > 0 ? lists : defaultWatchlists();
      persist(finalLists);
      return {
        lists: finalLists,
        activeListId: state.activeListId === id ? finalLists[0]?.id ?? null : state.activeListId,
      };
    });
  },
  reorderLists: (from, to) => {
    set((state) => {
      if (from < 0 || to < 0 || from >= state.lists.length || to >= state.lists.length) return state;
      const lists = [...state.lists];
      const [moved] = lists.splice(from, 1);
      lists.splice(to, 0, moved);
      persist(lists);
      return { lists };
    });
  },
  setActiveList: (id) => set({ activeListId: id }),
  addEntry: (listId, entry) => {
    const lists = get().lists;
    const target = lists.find((list) => list.id === listId);
    if (!target) return false;
    if (target.entries.some((e) => e.key === entry.key)) return false;
    const next = lists.map((list) =>
      list.id === listId ? { ...list, entries: [...list.entries, entry] } : list,
    );
    persist(next);
    set({ lists: next });
    return true;
  },
  removeEntry: (listId, key) => {
    const next = get().lists.map((list) =>
      list.id === listId
        ? { ...list, entries: list.entries.filter((entry) => entry.key !== key) }
        : list,
    );
    persist(next);
    set({ lists: next });
  },
  moveEntry: (fromListId, toListId, key) => {
    const state = get();
    const source = state.lists.find((list) => list.id === fromListId);
    const entry = source?.entries.find((e) => e.key === key);
    if (!entry) return false;
    const target = state.lists.find((list) => list.id === toListId);
    if (!target || target.entries.some((e) => e.key === key)) return false;
    const next = state.lists.map((list) => {
      if (list.id === fromListId) {
        return { ...list, entries: list.entries.filter((e) => e.key !== key) };
      }
      if (list.id === toListId) {
        return { ...list, entries: [...list.entries, entry] };
      }
      return list;
    });
    persist(next);
    set({ lists: next });
    return true;
  },
  isWatched: (key) => get().lists.some((list) => list.entries.some((entry) => entry.key === key)),
  listsForMarket: (market) => get().lists.filter((list) => list.entries.some((e) => e.market === market)),
  reset: () => {
    const lists = defaultWatchlists();
    persist(lists);
    set({ lists, activeListId: lists[0]?.id ?? null });
  },
}));

export { makeEntry };
