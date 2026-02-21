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
