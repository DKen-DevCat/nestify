interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-syne)] text-2xl font-bold">
        プレイリスト
      </h1>
      <p className="font-[family-name:var(--font-space-mono)] text-sm text-foreground/60 mt-2">
        ID: {id}
      </p>
      <p className="mt-4 text-foreground/40">
        Phase 2 で実装予定のプレイリスト詳細画面です。
      </p>
    </div>
  );
}
