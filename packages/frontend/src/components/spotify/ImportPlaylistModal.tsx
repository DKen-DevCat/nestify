"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Download, Search, Music2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  parentId?: string | null;
  onClose: () => void;
}

export function ImportPlaylistModal({ parentId = null, onClose }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);

  const {
    data: result,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["spotify-playlists"],
    queryFn: () => api.spotify.myPlaylists(),
    staleTime: 60_000,
  });

  const { mutate: importPlaylist } = useMutation({
    mutationFn: async (spotifyPlaylistId: string) => {
      setImportingId(spotifyPlaylistId);
      const res = await api.spotify.import(spotifyPlaylistId, parentId);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      onClose();
    },
    onSettled: () => {
      setImportingId(null);
    },
  });

  const playlists =
    result && result.ok
      ? result.data.filter((pl) =>
          pl.name.toLowerCase().includes(search.toLowerCase()),
        )
      : [];

  const errorMessage =
    isError || (result && !result.ok)
      ? (result && !result.ok ? result.error : "読み込みに失敗しました")
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg mx-4 flex flex-col max-h-[80vh] rounded-xl animate-fade-in-up"
        style={{
          background: "rgba(10, 9, 20, 0.98)",
          border: "1px solid rgba(124,106,247,0.2)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-accent-purple" />
            <h2 className="font-[family-name:var(--font-syne)] font-semibold text-white">
              Spotify からインポート
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 検索 */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Search size={14} className="text-foreground/40 shrink-0" />
            <input
              type="text"
              placeholder="プレイリストを検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder-foreground/30 outline-none"
            />
          </div>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 text-accent-pink text-sm py-8 justify-center">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isLoading && !errorMessage && playlists.length === 0 && (
            <p className="text-foreground/40 text-sm text-center py-8">
              {search ? "該当するプレイリストがありません" : "プレイリストがありません"}
            </p>
          )}

          {playlists.map((pl) => {
            const imageUrl = pl.images?.[0]?.url;
            const isImporting = importingId === pl.id;

            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => importPlaylist(pl.id)}
                disabled={importingId !== null}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group disabled:opacity-50"
              >
                {/* サムネイル */}
                <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/10 flex items-center justify-center">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={pl.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music2 size={16} className="text-foreground/30" />
                  )}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {pl.name}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {pl.tracks?.total ?? 0} 曲
                  </p>
                </div>

                {/* インポートボタン */}
                <div className="shrink-0">
                  {isImporting ? (
                    <div className="w-4 h-4 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download
                      size={14}
                      className="text-foreground/20 group-hover:text-accent-purple transition-colors"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-white/5 text-xs text-foreground/30 text-center">
          インポートしたプレイリストは Nestify のツリーに追加されます
        </div>
      </div>
    </div>
  );
}
