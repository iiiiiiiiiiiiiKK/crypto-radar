import { create } from "zustand";
import { createId } from "@/lib/storage";

export type ToastTone = "info" | "warn" | "bad";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  text?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = createId("toast");
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-4) }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
    }, 7000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

interface UiState {
  /** Incremented to ask the search input to take focus. */
  searchFocusToken: number;
  hotkeysOpen: boolean;
  focusSearch: () => void;
  setHotkeysOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  searchFocusToken: 0,
  hotkeysOpen: false,
  focusSearch: () => set((state) => ({ searchFocusToken: state.searchFocusToken + 1 })),
  setHotkeysOpen: (hotkeysOpen) => set({ hotkeysOpen }),
}));
