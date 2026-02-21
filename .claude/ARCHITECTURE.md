# Nestify — Architecture

## スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) + React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| クライアント状態 | Zustand |
| サーバー状態/キャッシュ | TanStack Query v5 |
| DnD | @dnd-kit |
| バックエンド | Hono on Bun |
| ORM | Drizzle ORM |
| DB | PostgreSQL (Supabase) |
| 型共有 | Hono RPC (`hc<AppType>`) |
| テスト | bun test (BE) + Playwright (E2E) |
| モノレポ | Bun Workspaces + Turborepo |
| デプロイ | Vercel (FE) + Railway/Fly.io (BE) |

---

## ディレクトリ構造

```
nestify/
├── package.json              # Bun workspaces ルート
├── turbo.json
├── tsconfig.base.json
│
├── packages/
│   ├── frontend/             # Next.js 15 + React 19
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/callback/page.tsx   # Spotify OAuthコールバック
│   │       │   └── playlists/[id]/page.tsx    # プレイリスト詳細
│   │       ├── components/
│   │       │   ├── tree/          # PlaylistTree, PlaylistTreeNode (再帰)
│   │       │   ├── playlist/      # TrackList, TrackItem, SubPlaylistGrid
│   │       │   ├── player/        # NowPlayingBar
│   │       │   └── ui/            # 汎用コンポーネント
│   │       ├── stores/            # Zustand stores
│   │       ├── hooks/
│   │       └── lib/
│   │           └── api.ts         # Hono RPCクライアント（型自動引き継ぎ）
│   │
│   ├── backend/              # Hono on Bun
│   │   └── src/
│   │       ├── index.ts           # エントリ・AppType export
│   │       ├── routes/            # auth / playlists / tracks / spotify
│   │       ├── db/                # Drizzle schema + migrations
│   │       ├── services/          # ビジネスロジック（再帰処理）
│   │       ├── middleware/        # JWT検証
│   │       └── __tests__/
│   │
│   └── shared/               # 共通型定義
│       └── src/types.ts
```

---

## データモデル

```typescript
interface Playlist {
  id: string
  userId: string
  parentId: string | null   // null = ルート。これだけで無限ネストを実現
  name: string
  icon: string              // emoji
  color: string             // CSSグラデーション
  order: number             // 兄弟間の並び順

  // APIレスポンス時の仮想フィールド
  children?: Playlist[]
  tracks?: PlaylistTrack[]
  trackCount?: number       // 子孫含む総曲数
}
```

ネスト構造は**隣接リスト**（parentId参照）で管理し、子孫の全曲収集は**再帰CTE**で行う。

```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM playlists WHERE id = $1
  UNION ALL
  SELECT p.id FROM playlists p
  JOIN descendants d ON p.parent_id = d.id
)
SELECT pt.* FROM playlist_tracks pt
WHERE pt.playlist_id IN (SELECT id FROM descendants);
```

---

## Hono RPC による型共有

バックエンドの型定義がフロントエンドに自動で伝わるのがこのスタックの最大の強みなのだよ。

```typescript
// backend/src/index.ts
export type AppType = typeof app   // ← これをexport

// frontend/src/lib/api.ts
import { hc } from 'hono/client'
import type { AppType } from '@nestify/backend'

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!)
// → api.playlists[':id'].tracks.$get() など、完全型安全で呼べる
```

---

## Spotify OAuth2 (PKCE)

```
GET /auth/login
  → code_verifier/challenge生成 → Spotifyへリダイレクト

GET /auth/callback?code=xxx
  → access_token + refresh_token取得
  → DBにユーザー保存
  → JWTを生成してフロントへリダイレクト

以降: Authorization: Bearer {jwt} でAPI認証
バックエンドがSpotify APIのプロキシとして動作（トークン自動refresh）
```

必要スコープ: `playlist-read-private` `playlist-modify-private` `streaming` `user-modify-playback-state`

---

## 開発コマンド

```bash
bun install          # セットアップ
bun dev              # 全パッケージ並列起動（Turborepo）
bun test             # バックエンドテスト（bun testビルトイン、Vitest不要）

bun --filter backend db:generate   # Drizzle マイグレーション生成
bun --filter backend db:migrate    # マイグレーション実行
```

---

## 実装フェーズ

**Phase 1（基盤）**
モノレポ構築 → 型定義 → DBスキーマ → Spotify OAuth → プレイリストCRUD API → ツリーUI

**Phase 2（コア機能）**
TanStack QueryでAPI接続 → 再帰CTE実装 → Spotify Web Playback SDK → シャッフル/直接再生切り替え

**Phase 3（UX強化）**
DnD（@dnd-kit）→ Spotify書き出し・インポート → テスト追加
