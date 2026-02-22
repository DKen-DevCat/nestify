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

## Phase 1 残り + Phase 2 実装（完了）

- [x] Step 3: DB_MODE=mock 対応 + drizzle.config.ts
- [x] Step 4: Spotify OAuth スキャフォルディング
- [x] Step 5: プレイリスト CRUD API（ROP スタイル + 再帰 CTE）
- [x] Step 6: ログイン画面 + OAuth コールバック
- [x] Step 7: ツリーUI（PlaylistTree + PlaylistTreeNode）
- [x] Step 8: TanStack Query + Zustand で API 接続
- [x] Step 9: GET /:id/tracks 再帰 CTE
- [x] Step 10: Spotify Web Playback SDK + playerStore
- [x] Step 11: シャッフル再生・直接のみ再生

## Phase 3: UX 強化（完了）

### Phase 3-A: DEV_BYPASS_AUTH
- [x] `routes/auth.ts` に GET /auth/dev-token を追加（DB_MODE=mock + DEV_BYPASS_AUTH=true 限定）
- [x] `(auth)/dev-login/page.tsx` + `DevLoginClient.tsx` 作成
- [x] ログイン画面に開発用ショートカットリンクを追加

### Phase 3-B: プレイリスト作成・削除 UI
- [x] `hooks/usePlaylistMutations.ts`（create / update / delete）
- [x] `components/playlist/CreatePlaylistModal.tsx`（アイコン選択 + 名前入力）
- [x] サイドバーの + ボタンからモーダルを開けるように統合
- [x] 詳細ページに「サブPL 追加」ボタン + 削除確認ダイアログ

### Phase 3-C: ドラッグ&ドロップ
- [x] `@dnd-kit/core` / `sortable` / `utilities` を追加
- [x] `PlaylistTreeNode` に GripVertical ハンドル + useSortable 追加
- [x] `PlaylistTree` に DndContext + SortableContext を追加
- [x] サイドバーに `onReorder` ハンドラ（PATCH /api/playlists/:id）を実装

### Phase 3-D: bun test ユニットテスト
- [x] `src/__tests__/playlistService.test.ts` 作成
- [x] getTree / getById / create / update / deletePlaylist / getTracksRecursive テスト
- [x] 13 テスト全通過（`bun test`）

## 残実装

### 残-A: Drizzle マイグレーション（完了）
- [x] `drizzle.config.ts` 作成
- [x] `src/db/migrations/0000_initial.sql` 作成（users / playlists / playlist_tracks テーブル）
- [x] `src/db/migrations/meta/_journal.json` 作成
- [x] `src/db/migrate.ts` 作成（スタンドアロン実行スクリプト）
- [x] `package.json` の `db:migrate` スクリプトを更新

### 残-B: Spotify サービス + インポート/エクスポート API（完了）
- [x] `services/spotifyService.ts` 作成（refreshToken / getUserPlaylists / importSpotifyPlaylist / exportToSpotify）
- [x] `routes/spotify.ts` 作成（GET /api/spotify/me/playlists, POST /api/spotify/import, POST /api/spotify/export/:id）
- [x] `index.ts` に spotifyRoutes を登録

### バグ修正
- [x] `(auth)` ルートグループの URL パス誤り修正（`/auth/dev-login` → `/dev-login`）
- [x] `/playlists/page.tsx` が存在せず 404 になっていた問題を修正（案内ページを追加）
- [x] `DevLoginClient` のエラー時リンク修正（`/auth/login` → `/login`）
- [x] `PlaylistSidebar` に認証ガード追加（未認証時 → `/login` リダイレクト）

## E2E テスト（Playwright）

- [x] `packages/e2e` ワークスペース作成・Playwright インストール（Chromium）
- [x] `playwright.config.ts`：setup / unauthenticated / authenticated の3プロジェクト構成
- [x] `tests/smoke.spec.ts`：フロント・バックエンドの起動確認
- [x] `tests/auth.spec.ts`：未認証リダイレクト・ログインページ・dev-login フロー
- [x] `tests/playlists.spec.ts`：ツリー表示・選択・作成・展開・詳細ページ・削除ダイアログ
- [x] 20 テスト全通過（`playwright test`）

### 未コミットファイルの整理
- [x] 残-A / 残-B のバックエンドファイルがコミット漏れしていたため commit

## 実 DB / Spotify OAuth 接続

- [x] Supabase DB マイグレーション実行（users / playlists / playlist_tracks テーブル作成）
- [x] `.env` に `SPOTIFY_REDIRECT_URI` 追加・`DB_MODE=db` に切り替え
- [x] `auth.ts` バグ修正：
  - `/auth/login` を JSON 返却 → 302 リダイレクトに変更
  - PKCE パラメータ名 `client_verifier` → `code_verifier` に修正
  - コールバック後リダイレクト先 `/auth/callback` → `/callback` に修正
  - DB upsert 実装（users テーブルへの insert/update）

### 残-C: フロントエンド Spotify インポート/エクスポート UI（完了）
- [x] `lib/api.ts` に `api.spotify.{myPlaylists, import, export}` を追加
- [x] `SpotifySimplifiedPlaylist` 型を `api.ts` に追加
- [x] `components/spotify/ImportPlaylistModal.tsx` 作成（一覧・検索・1クリックインポート）
- [x] サイドバーにダウンロードアイコンでインポートモーダルを統合
- [x] 詳細ページに「Spotify へ書き出し」ボタン + 成功時に Spotify リンクを表示

## デプロイ

### バックエンド: Cloudflare Workers（完了）
- [x] `pkce_states` テーブルを Supabase に追加（CF Workers ステートレス対応）
- [x] `auth.ts`: PKCE state をインメモリ Map → DB に移行
- [x] `db/index.ts`: DB 遅延初期化（initDb()）に変更
- [x] `index.ts`: CF Workers env バインディングを process.env に注入するラッパー追加
- [x] `wrangler.toml` 作成・シークレット設定・デプロイ完了
- [x] URL: https://nestify-backend.dken-devdev.workers.dev

### フロントエンド: Vercel（完了）
- [x] GitHub にプッシュ
- [x] Vercel にプロジェクトをインポート
- [x] 環境変数を設定（NEXT_PUBLIC_API_URL）
- [x] デプロイ完了・本番 URL 確定（https://nestify-frontend-57y3.vercel.app）
- [x] wrangler.toml の FRONTEND_URL を本番 URL に更新して再デプロイ

### 本番バグ修正（完了）
- [x] CF Workers I/O エラー修正：リクエストごとに postgres 接続を新規作成・closeDb() を finally で呼ぶ
- [x] CallbackHandler.tsx: エラー時リダイレクト /auth/login → /login に修正
- [x] Bug 1: トラック名が ID 表示 → /:id/tracks エンドポイントで Spotify API からバッチ取得してメタデータ付与
- [x] Bug 2: Spotifyインポート重複 → playlists.spotifyPlaylistId カラム追加、インポート前に重複チェック
- [x] Bug 3: プレイリストアイコン → playlists.imageUrl カラム追加、インポート時に Spotify カバー画像 URL 保存・フロントで表示
