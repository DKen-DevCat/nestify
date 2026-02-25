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

### トラック詳細情報の表示（完了）
- [x] アルバムアートのサムネイル表示
- [x] アルバム名カラム追加
- [x] 追加日カラム追加（ja-JP ロケール）
- [x] グリッドを `[16px_auto_1fr_1fr_auto_auto]` に拡張

### バグ修正: 曲検索失敗 + 部分一致対応
- [x] `apiFetch` で非 JSON レスポンスの例外をハンドリング
- [x] `AddTrackModal` の `queryFn` で `{ ok: false }` を throw に変換
- [x] `searchTracks` から `market=JP` を削除（全世界の楽曲を対象に）
- [x] `data.tracks?.items` に null チェック追加

## Spotify 曲検索 & プレイリスト追加

- [x] BE: `searchTracks(query, userId)` を `spotifyService.ts` に追加
- [x] BE: `GET /api/spotify/search` ルートを追加
- [x] BE: `addTrack(playlistId, spotifyTrackId, userId)` を `playlistService.ts` に追加
- [x] BE: `POST /api/playlists/:id/tracks` ルートを追加
- [x] FE: `api.spotify.search` + `api.playlists.addTrack` を `api.ts` に追加
- [x] FE: `useAddTrack` hook を `usePlaylistMutations.ts` に追加
- [x] FE: `AddTrackModal.tsx` を新規作成
- [x] FE: `PlaylistDetailView.tsx` に「曲を追加」ボタン統合

### 追加機能実装

- [x] プレイリスト名のインライン変更機能
- [x] Spotify エクスポートを既存 playlist の更新に対応（spotifyPlaylistId で管理）
- [x] 詳細ページで子孫プレイリストをツリー形式で表示

## DnD トラック並べ替え + Auth UX 最適化（完了）
- [x] PATCH /api/playlists/:id/tracks/reorder エンドポイント追加
- [x] PlaylistDetailView: 直接追加曲のみドラッグ可、楽観的更新でエラー時リセット
- [x] middleware.ts: Cookie ベース認証ルーティング（/playlists→/login、/login→/playlists、/→分岐）
- [x] CallbackHandler: JWT をクッキー（SameSite=Lax, 30日）にも保存
- [x] api.ts: 401 時にクッキー + localStorage をクリアして /login へ

## 混在 DnD 並び替え + 子 PL 名前変更（完了）
- [x] playlistService.ts: reorderItems 関数追加（トラックと子 PL を統一的に並び替え）
- [x] routes/playlists.ts: PATCH /:id/items/reorder エンドポイント追加（PATCH /:id より前に登録）
- [x] api.ts: reorderItems メソッド追加
- [x] usePlaylistMutations.ts: useReorderItems フック追加
- [x] PlaylistDetailView.tsx: PlaylistLevelContent + SortablePlaylistSection で混在 DnD + 子 PL インライン名前変更
- [x] tsc --noEmit で型エラーなし確認

## レスポンシブ対応 / サイドバー開閉・リサイズ / 曲順同期バグ修正（完了）
- [x] playlistService.ts: getTracksRecursive を DFS traversal に変更（ORDER BY pt.order のみ依存 → childrenByParent + tracksMap で正確な順序を再現）
- [x] hooks/useSidebar.ts: 新規作成（開閉状態・幅の localStorage 永続化、ドラッグリサイズ、SSR 安全）
- [x] PlaylistSidebar.tsx: useSidebar 統合・ChevronLeft/Right 開閉ボタン・ドラッグハンドル・onNavigate prop・モーダルを aside 外に移動
- [x] PlaylistsLayoutClient.tsx: 新規作成（モバイル overlay drawer + ハンバーガーヘッダー管理）
- [x] layout.tsx: PlaylistsLayoutClient に委譲（Server Component 維持）
- [x] tsc --noEmit でバックエンド・フロントエンド両方エラーなし確認
- [x] コミット分割: バグ修正（BE）+ サイドバー・レスポンシブ（FE）

## Spotify 書き出し機能拡張（完了）
- [x] spotifyService.ts: exportSubtreeToSpotify 追加（全子孫 PL をそれぞれ独立した Spotify PL として書き出し）
- [x] routes/spotify.ts: POST /api/spotify/export-tree/:playlistId エンドポイント追加
- [x] api.ts: api.spotify.exportTree 追加
- [x] PlaylistDetailView.tsx: exportedUrl → exportedUrls(Record)、書き出しボタンと Spotify で開くボタンを分離（書き出し完了後に活性化）
- [x] tsc --noEmit でフロント・バックエンド両方エラーなし確認

## 本番バグ修正: CORS + ImportPlaylistModal クラッシュ（完了）
- [x] index.ts: cors({ origin: "*" }) に変更 + initDb() を try ブロック内に移動（CORSヘッダーが確実に付くように）
- [x] ImportPlaylistModal.tsx: pl.images[0]?.url → pl.images?.[0]?.url（Spotify が images:null を返すと null[0] でクラッシュ）
- [x] api.ts: SpotifySimplifiedPlaylist.images を `{ url: string }[] | null` に修正
- [x] wrangler deploy で CF Workers を再デプロイ

## 3機能追加（完了）
- [x] Feature 2: AddTrackModal に追加先プレイリスト選択ドロップダウンを追加（子孫PL一覧、デフォルト=現在PL）
- [x] BE: moveTrack サービス関数 + PATCH /:id/tracks/:trackId/move ルート追加（mock/DB両対応）
- [x] FE: api.playlists.moveTrack + useMoveTrack hook 追加
- [x] Feature 3: PlaylistTree に onDragOver ゾーン判定DnD追加（上端=前/中央=子にネスト/下端=後）
- [x] Feature 3: PlaylistTreeNode に dragOverZone prop + 視覚インジケーター（before/inside/after）追加
- [x] Feature 3: PlaylistSidebar に handleNest（循環参照防止付き）+ findPlaylistById ヘルパー追加
- [x] Feature 1: PlaylistDetailView を単一 DndContext に統合（DetailDndCtx + containerItems + trackToContainer）
- [x] Feature 1: クロスコンテナ曲移動（moveTrack API 呼び出し + 楽観的更新 + エラー時ロールバック）
- [x] Feature 1: DragOverlay でドラッグ中の見た目を表示
- [x] tsc --noEmit でフロント・バックエンド両方エラーなし確認

## PLツリーホバー時プリフェッチ（完了）
- [x] PlaylistTreeNode: onMouseEnter で playlist-tracks をプリフェッチ（クリック前にフェッチ開始）

## 再生機能の全削除（完了）
- [x] playerStore.ts / spotify.ts / useSpotifyPlayer.ts / NowPlayingBar.tsx を削除
- [x] PlaylistsLayoutClient.tsx から NowPlayingBar を除去
- [x] PlaylistDetailView.tsx から handlePlay / Play / Shuffle ボタン / currentTrack / isCurrentTrack を除去

## Spotify import 曲数0問題の修正（完了）
- [x] api.ts: SpotifySimplifiedPlaylist.tracks を optional/nullable に変更
- [x] ImportPlaylistModal.tsx: pl.tracks?.total ?? 0 で安全にアクセス
- [x] spotifyService.ts: (tracksPage.items ?? []) と item?.track != null で null セーフ化
- [x] spotifyService.ts バックエンド型も同様に修正

## トラックメタデータ DB キャッシュ（完了）
- [x] DB スキーマ: playlist_tracks に 7 カラム追加（track_name/artists/album/duration/preview/image/cached_at）
- [x] migration 0002_track_metadata_cache.sql 作成
- [x] _journal.json にエントリ追加
- [x] playlistService.ts: addTrack に trackMetadata 引数追加（INSERT 時にキャッシュ保存）
- [x] playlistService.ts: getTracksRecursive の TrackRow 型拡張 + buildOrdered でキャッシュから track 構築
- [x] playlistService.ts: mock モードで MOCK_TRACKS の track フィールドをキャッシュカラムとして展開
- [x] spotifyService.ts: enrichTracksWithSpotifyData が未キャッシュのみ Spotify API 呼び出し + fire-and-forget DB 保存
- [x] routes/playlists.ts: addTrack の zValidator に trackMetadata フィールド追加
- [x] api.ts: addTrack に trackMetadata 引数追加
- [x] AddTrackModal.tsx: handleAdd がトラックのメタデータを addTrack に渡す

## UI 最適化（完了）
- [x] globals.css: 雰囲気ある背景グラデーション（ラジアルグロー）・カスタムスクロールバー・keyframes（float/orb-drift/fade-in-up等）
- [x] globals.css: テキストグラデーション・グラスモーフィズム用ユーティリティクラス追加
- [x] login/page.tsx: アニメーション背景オーブ（CSS animation）・ロゴグラデーション・シマーボタン
- [x] PlaylistTreeNode.tsx: 選択状態に左アクセントバー + グラデーション背景、インジケーターをグラデーション化、子ノードの区切り線を accent-purple に
- [x] PlaylistSidebar.tsx: ヘッダーに accent-purple グラデーション border-bottom + 微妙な背景グラデーション、空状態メッセージ追加
- [x] PlaylistsLayoutClient.tsx: モバイルヘッダーのスタイルをサイドバーと統一、drawer にスライドインアニメーション
- [x] PlaylistDetailView.tsx: カバーアートに box-shadow グロー、ActionButton コンポーネント分離、空状態をアイコン付きに、削除ダイアログのスタイル改善、トラック行のホバー・サムネイル微アニメーション
- [x] CreatePlaylistModal / AddTrackModal / ImportPlaylistModal: モーダル背景・ボーダーカラーを accent-purple ベースに統一、fade-in-up アニメーション追加

## パフォーマンス最適化（完了）
- [x] next.config.ts: reactStrictMode / compress / React Compiler(experimental) / avif+webp / Spotify CDN remotePatterns 追加
- [x] <img> → next/image に全8箇所置き換え（AddTrackModal / ImportPlaylistModal / PlaylistTreeNode / PlaylistDetailView）
- [x] CreatePlaylistModal / AddTrackModal / ImportPlaylistModal を next/dynamic で遅延ロード（初期バンドル削減）
- [x] staleTime を 30-60s → 5min に延長（playlists / playlist-tracks / spotify-playlists / prefetch）
- [x] .claude/skills に nextjs-optimization / react-best-practices を追加
- [x] babel-plugin-react-compiler をインストール（React Compiler 動作に必要）

## SEO 最適化（完了）
- [x] layout.tsx: metadataBase / title template / description / keywords / OG / Twitter Card / robots(noindex) 追加
- [x] opengraph-image.tsx: Edge Runtime の動的 OG 画像生成（ImageResponse）
- [x] robots.ts: 全ページ noindex、/login のみ allow
- [x] sitemap.ts: /login のみ収録
- [x] manifest.ts: PWA マニフェスト（name / theme_color / background_color / icons）
- [x] login/page.tsx: index:true + OG metadata を追加（唯一の公開ページ）
- [x] playlists/layout.tsx: robots noindex を明示

## permissions 修正（完了）
- [x] Bash(:* → *) 全パターンを非推奨の `:*` から推奨の ` *` に変更
- [x] `Edit` / `Write` を allow に追加（ファイル編集の都度承認を解消）
- [x] `Bash(cd * && ~/.bun/bin/bun *)` / `Bash(cd * && bun *)` を追加（型チェックコマンドをカバー）
- [x] settings.local.json.example を permissions 含む完全な例に更新

## Codex レビュー自動対応（完了）
- [x] trigger-codex-review.sh: Codex レビュー後に claude --dangerously-skip-permissions -p で自動対応を起動
- [x] .auto-review-lock ファイルで Stop フックの再帰呼び出しを防止（1段階のみ）
- [x] settings.local.json / .example: timeout を 120 → 300 秒に変更
- [x] .gitignore に .auto-review-lock を追加

## pre-push フック追加（完了）
- [x] .husky/pre-push 作成：plan.md に「Claude Code 対応待ち」が残っていると push をブロック
- [x] 実行権限付与・動作確認（未対応なし → 通過、未対応あり → ブロック）

## Codex レビュー対応 — 2026-02-24（完了）
- [x] robots.ts: 同一 user-agent に別ルールを2つ記述していた曖昧な書き方を、単一ルール（allow + disallow）に統合
- [x] layout.tsx: openGraph.images を明示追加（/opengraph-image への参照）
- [x] layout.tsx: SITE_URL を NEXT_PUBLIC_SITE_URL 環境変数からの取得に変更（フォールバック付き）

## Codex レビュー対応 — 2026-02-24 18:24:11
- [x] Issues: none obvious — コード修正不要
- [x] Suggestion 確認: `Bash(chmod *)` / `Bash(cd * && bun *)` パターンは Nestify 開発フロー（スクリプト権限付与・型チェック）に必要と判断、維持

## Codex レビュー対応 — 2026-02-24 18:33:20
- [x] Issues: none found — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミット履歴については、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 18:36:10
- [x] Issues: none found — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 18:39:57
- [x] Issues: none — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 18:44:25
- [x] Issues: none — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 18:47:57
- [x] Issues: none — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 23:51:44
- [x] Issues: none — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-24 23:56:06
- [x] Issues: none — コード修正不要
- [x] Suggestion 確認: `.claude/plan.md` / `.claude/tasks.md` のコミットについては、レビュートレーサビリティのため現在の方針（コミットに含める）を維持

## Codex レビュー対応 — 2026-02-25 00:42:39
- [x] Issue: NowPlayingBar がトラック選択を受け取れない → SortableTrackItem / SimpleTrackItem に onClick ハンドラを追加し `playTrack(track.track, track.playlistId)` を呼び出す
- [x] Issue: アクティブ曲のハイライトなし → `currentTrack?.id === track.track?.id` でアクセントカラー（#7c6af7）でトラック名を強調
- [x] Suggestion: icon-only コントロールに aria-label 追加 → NowPlayingBar の SkipBack / Play・Pause / SkipForward ボタンに `aria-label` を追加
- [x] tsc --noEmit でフロントエンドエラーなし確認

## UI/UX 全面改善 — Spotify デザインパターン踏襲（完了）
- [x] globals.css: 背景色 #0a0a14、--foreground #ffffff、--color-surface-hover 追加、グロー強度微調整
- [x] stores/playerStore.ts: 新規作成（currentTrack / isPlaying / includeChildren / sourcePlaylistId）
- [x] components/player/NowPlayingBar.tsx: 新規作成（Spotify 風 72px ボトムバー、3カラム構成）
- [x] PlaylistsLayoutClient.tsx: h-screen / overflow-hidden レイアウト、NowPlayingBar 下部固定追加
- [x] PlaylistDetailView.tsx: ヒーローヘッダー大型化（192px カバーアート + グラデーション背景）、アクションバー大型円形ボタン、sticky トラックヘッダー、番号→再生アイコン hover、アルバムアートオーバーレイ、空状態改善
- [x] PlaylistTreeNode.tsx: アイコン 32px、ホバー白/7%、選択テキスト white、行高さ py-2
- [x] PlaylistSidebar.tsx: 「マイライブラリ」ヘッダー、「プレイリスト」セクションラベル、閉じ時ボタン w-10

## UX 改善 3機能（完了）
- [x] InlineTrackSearch.tsx: 新規作成（AddTrackModal の非モーダル版、インラインパネル形式）
- [x] PlaylistDetailView.tsx: AddTrackModal → InlineTrackSearch に置き換え（アクションバー直下にインライン表示、ListPlus ボタンはトグル動作）
- [x] PlaylistDetailView.tsx: heroRef + IntersectionObserver でヒーロースクロールアウト時にスティッキーコンパクトヘッダーを表示
- [x] PlaylistDetailView.tsx: isError 時に refetch() を呼ぶ「再試行」ボタンを追加（RefreshCw アイコン）
- [x] tsc --noEmit でフロントエンドエラーなし確認

## Codex レビュー対応 — 2026-02-25 00:11:56
- [x] Issue: `AbortSignal.timeout` がタイムアウトした場合の abort エラーが未処理 → `.catch((): null => null)` で null に変換し `Result` として返すよう修正
  - `refreshAccessToken`: タイムアウト時に `{ ok: false, error: "...", status: 504 }` を返す
  - `searchTracks`: タイムアウト時に `{ ok: false, error: "...", status: 504 }` を返す
  - `enrichTracksWithSpotifyData`: タイムアウト時にそのチャンクをスキップ（`continue`）
- [x] Suggestion: `AbortSignal.timeout` の Bun ランタイムサポート確認 — Bun は Web APIs 準拠のため対応済み
- [x] Suggestion: `retry: 1` の UX 妥当性確認 — 10s タイムアウト × 3 retry = 最大 30 秒待ちを避けるための意図的な設計。維持。
- [x] tsc --noEmit でバックエンドエラーなし確認
