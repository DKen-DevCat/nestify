export default function PlaylistsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* サイドバー（Phase 2 で実装） */}
      <aside className="w-64 border-r border-white/10 p-4">
        <p className="font-[family-name:var(--font-syne)] text-accent-purple font-bold text-lg">
          Nestify
        </p>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
