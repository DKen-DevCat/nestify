"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useCreatePlaylist } from "@/hooks/usePlaylistMutations";

interface Props {
  parentId?: string | null;
  onClose: () => void;
}

const ICON_OPTIONS = ["🎵", "🎸", "🎹", "🎺", "🥁", "🎻", "🎤", "🎧", "☕", "🌙", "💪", "🌅", "🌊", "🔥", "✨", "🎮"];

export function CreatePlaylistModal({ parentId = null, onClose }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎵");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: createPlaylist, isPending } = useCreatePlaylist();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createPlaylist(
      { name: name.trim(), icon, parentId },
      { onSuccess: () => onClose() },
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold">
            新しいプレイリスト
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-foreground/40 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* アイコン選択 */}
          <div>
            <label className="text-xs text-foreground/50 mb-2 block">アイコン</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={[
                    "w-9 h-9 rounded-lg text-lg transition-colors",
                    icon === emoji
                      ? "bg-accent-purple/30 ring-1 ring-accent-purple"
                      : "hover:bg-white/10",
                  ].join(" ")}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 名前入力 */}
          <div>
            <label className="text-xs text-foreground/50 mb-1.5 block">
              プレイリスト名
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: Morning Vibes"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-foreground/30 focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-foreground/60 hover:bg-white/5 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #7c6af7, #f76a8a)" }}
            >
              {isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
