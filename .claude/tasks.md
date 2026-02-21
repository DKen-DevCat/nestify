# Tasks

## Codex レビュー自動連携のセットアップ

- [x] `.claude/scripts/` ディレクトリを作成し、`trigger-codex-review.sh` を配置する
- [x] スクリプトにレビュー結果を `.claude/plan.md` へ追記する処理を実装する
- [x] `.claude/settings.local.json` に Stop フックを設定する
- [x] `.claude/settings.local.json.example` をテンプレートとして作成する（コミット用）
- [x] `.gitignore` に `.claude/settings.local.json` を追加する

## Phase 1: モノレポセットアップ + 共通型定義 + バックエンド基盤

- [x] Bun 1.3.9 をインストール
- [x] ルート `package.json` を Bun workspaces 対応に書き換え
- [x] `turbo.json` を作成
- [x] `tsconfig.base.json` を作成
- [x] `packages/shared` を作成（Playlist, PlaylistTrack, SpotifyTrack 等の共通型定義）
- [x] `packages/backend` を作成（Hono エントリポイント + Drizzle スキーマ + DB 接続）
- [x] `packages/frontend` を作成（既存 Next.js を移行）
- [x] フォントを Syne + Space Mono に変更、ダークテーマ固定、アクセントカラー変数追加
- [x] `page.tsx` を `/playlists` へのリダイレクトに変更
- [x] `playlists/layout.tsx` と `[id]/page.tsx` のスキャフォルディング作成
- [x] `.gitignore` を更新（`.turbo/` を追加）
- [x] ルートの不要ファイル（`src/`, `tsconfig.json` 等）を削除
- [x] `trigger-codex-review.sh` をコミット後もレビュー対象にするよう修正

## ワークフロー仕組み化

- [x] Husky をルート devDependencies に追加
- [x] `.husky/pre-commit` で tasks.md 未更新時にコミットをブロック

## Phase 1 残り + Phase 2 実装

### Step 3: DB 安全起動 + Drizzle Kit 設定
- [x] `drizzle.config.ts` 作成
- [x] `db/index.ts` を DB_MODE=mock 対応に更新
- [x] `db/mock.ts` を作成（インメモリモックデータ）

### Step 4: Spotify OAuth スキャフォルディング
- [x] `routes/auth.ts` 作成（PKCE フロー + JWT 生成）
- [x] `middleware/auth.ts` 作成（JWT 検証）

### Step 5: プレイリスト CRUD API
- [x] `services/playlistService.ts` 作成（ROP スタイル + 再帰 CTE）
- [x] `routes/playlists.ts` 作成
- [x] `index.ts` 更新（ルート登録）

### Step 6: ログイン画面 + OAuth コールバック
- [x] `(auth)/login/page.tsx` 作成
- [x] `(auth)/callback/page.tsx` + `CallbackHandler.tsx` 作成

### Step 7: ツリーUI（PlaylistTree + PlaylistTreeNode）
- [x] `components/tree/PlaylistTreeNode.tsx` 作成（再帰ノード）
- [x] `components/tree/PlaylistTree.tsx` 作成
- [x] `playlists/layout.tsx` 更新（サイドバー統合）
- [x] `playlists/PlaylistSidebar.tsx` 作成

### Step 8: TanStack Query + Zustand で API 接続
- [x] `lib/api.ts` 作成（型付き fetch ラッパー）
- [x] `stores/playlistStore.ts` 作成（selectedId + expandedIds）
- [x] `hooks/usePlaylistTree.ts` 作成
- [x] `hooks/usePlaylistTracks.ts` 作成
- [x] `app/providers.tsx` 作成（QueryClientProvider）
- [x] `app/layout.tsx` 更新（Providers 追加）

### Step 9: GET /:id/tracks 再帰 CTE
- [x] `playlistService.ts` に `getTracksRecursive` 実装（モック + 再帰 CTE）

### Step 10: Spotify Web Playback SDK + playerStore
- [x] `lib/spotify.ts` 作成（SDK ロード + 再生開始）
- [x] `stores/playerStore.ts` 作成
- [x] `hooks/useSpotifyPlayer.ts` 作成
- [x] `components/player/NowPlayingBar.tsx` 作成
- [x] `playlists/layout.tsx` 更新（NowPlayingBar 追加）

### Step 11: シャッフル再生・直接のみ再生
- [x] `playerStore` に `playPlaylist(id, tracks, {includeChildren, shuffle})` 実装
- [x] Fisher-Yates シャッフル実装
- [x] `playlists/[id]/page.tsx` → `PlaylistDetailView.tsx` に再生ボタン追加
- [x] 継承バッジ（`継承 · {ソースPL名}`）表示

