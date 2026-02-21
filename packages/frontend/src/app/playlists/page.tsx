import { Music2 } from "lucide-react";

export default function PlaylistsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center gap-4">
      <Music2 size={48} className="text-foreground/10" />
      <p className="text-foreground/40 text-sm">
        左のサイドバーからプレイリストを選択してください
      </p>
    </div>
  );
}
