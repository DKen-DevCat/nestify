import { create } from "zustand";

// サーバー状態（Playlist ツリーデータ）は TanStack Query に委ねる。
// ここではクライアント固有の UI 状態のみを管理する。

interface PlaylistStore {
  selectedId: string | null;
  expandedIds: Set<string>;

  select: (id: string) => void;
  toggleExpand: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
}

export const usePlaylistStore = create<PlaylistStore>((set) => ({
  selectedId: null,
  expandedIds: new Set<string>(),

  select: (id) => set({ selectedId: id }),

  toggleExpand: (id) =>
    set((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { expandedIds: next };
    }),

  expandAll: (ids) => set({ expandedIds: new Set(ids) }),

  collapseAll: () => set({ expandedIds: new Set<string>() }),
}));
