#!/usr/bin/env bash
# trigger-codex-review.sh
# Claude Code の Stop フックから呼び出される。
# 1. Codex にレビューを依頼して plan.md に追記する。
# 2. Issues があれば Claude Code を非対話モードで起動して自動対応・コミットする。
# ロックファイル (.auto-review-lock) で Stop フックの再帰呼び出しを防ぐ。
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
PLAN_FILE="$PROJECT_DIR/.claude/plan.md"
LOCK_FILE="$PROJECT_DIR/.claude/.auto-review-lock"

# ─── 自動レビュー応答セッションの終了を検出 ──────────────────────────
# ロックファイルがある = 直前の Stop は自動対応セッションの終了
# → ファイルを削除して終了（再帰させない）
if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
  echo "[codex-review] 自動レビュー応答セッション完了。"
  exit 0
fi

# ─── git 変更チェック ─────────────────────────────────────────────────
HAS_UNSTAGED=$(git -C "$PROJECT_DIR" diff --quiet 2>/dev/null; echo $?)
HAS_STAGED=$(git -C "$PROJECT_DIR" diff --cached --quiet 2>/dev/null; echo $?)
HAS_COMMITS=$(git -C "$PROJECT_DIR" rev-parse --verify HEAD >/dev/null 2>&1; echo $?)

if [ "$HAS_UNSTAGED" = "0" ] && [ "$HAS_STAGED" = "0" ] && [ "$HAS_COMMITS" != "0" ]; then
  echo "[codex-review] git 変更なし。スキップ。"
  exit 0
fi

# ─── Codex レビュー実行 ──────────────────────────────────────────────
echo "[codex-review] Codex レビュー開始..."
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REVIEW_OUTPUT=$(copilot --model gpt-5.2-codex \
  --add-dir "$PROJECT_DIR" \
  --allow-all \
  -s \
  -p "Review the latest changes in this workspace. First run 'git diff' to check unstaged changes, 'git diff --cached' for staged changes, and 'git show HEAD --stat' with 'git diff HEAD~1 HEAD' for the latest commit. List issues, suggestions, and positive findings. Be concise and specific.")

{
  echo ""
  echo "---"
  echo ""
  echo "## Codex レビュー — $TIMESTAMP"
  echo ""
  echo "$REVIEW_OUTPUT"
  echo ""
  echo "> ステータス: レビュー完了 / Claude Code 対応待ち"
} >> "$PLAN_FILE"

echo "[codex-review] plan.md にレビュー追記完了。"

# ─── Claude Code による自動対応 ──────────────────────────────────────
# ロックファイルを作成してから起動（再帰防止）
touch "$LOCK_FILE"
echo "[codex-review] Claude Code による自動対応を開始..."

claude --dangerously-skip-permissions -p \
".claude/plan.md の最新の Codex レビュー（「Claude Code 対応待ち」のもの）を確認してください。

Issues の指摘が「None」または無い場合:
  - plan.md のステータスを「対応完了（Issues なし）」に更新する
  - .claude/tasks.md に「Codex レビュー対応 — TIMESTAMP: Issues なし」を追記する
  - git commit する（tasks.md と plan.md を含める）

Issues の指摘がある場合:
  - 指摘事項をコードで修正する
  - .claude/tasks.md に「## Codex レビュー対応 — TIMESTAMP」セクションを追加し対応内容を記録する
  - plan.md のステータスを「対応完了」に更新する
  - git commit する（修正ファイル + tasks.md + plan.md を含める）

型チェックが必要な場合は bun tsc --noEmit で確認してから commit すること。"

echo "[codex-review] 自動対応完了。"
