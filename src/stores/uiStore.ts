import { create } from "zustand";

interface UiState {
  search: string;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  setSearch: (value: string) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  search: "",
  sidebarCollapsed: false,
  rightPanelOpen: true,
  setSearch: (search) => set({ search }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
}));
