#!/usr/bin/env bash
# trigger-codex-review.sh
# Claude Code の Stop フックから呼び出され、Codex にコードレビューを依頼する。
# レビュー結果は .claude/plan.md に追記される。
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
PLAN_FILE="$PROJECT_DIR/.claude/plan.md"

# 未コミットの変更 OR 最新コミットが存在するか確認
HAS_UNSTAGED=$(git -C "$PROJECT_DIR" diff --quiet 2>/dev/null; echo $?)
HAS_STAGED=$(git -C "$PROJECT_DIR" diff --cached --quiet 2>/dev/null; echo $?)
HAS_COMMITS=$(git -C "$PROJECT_DIR" log --oneline -1 2>/dev/null | wc -l | tr -d ' ')

if [ "$HAS_UNSTAGED" = "0" ] && [ "$HAS_STAGED" = "0" ] && [ "$HAS_COMMITS" = "0" ]; then
  echo "[trigger-codex-review] No git activity; skipping Codex review."
  exit 0
fi

echo "[trigger-codex-review] Starting Codex review..."

# Codex によるレビューを実行し、結果を plan.md に追記
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

echo "[trigger-codex-review] Review appended to $PLAN_FILE"
