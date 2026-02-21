#!/usr/bin/env bash
# trigger-codex-review.sh
# Claude Code の Stop フックから呼び出され、Codex にコードレビューを依頼する。
# レビュー結果は .claude/plan.md に追記される。
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
PLAN_FILE="$PROJECT_DIR/.claude/plan.md"

# git の変更がない場合はスキップ
if git -C "$PROJECT_DIR" diff --quiet 2>/dev/null && \
   git -C "$PROJECT_DIR" diff --cached --quiet 2>/dev/null; then
  echo "[trigger-codex-review] No git changes; skipping Codex review."
  exit 0
fi

echo "[trigger-codex-review] Starting Codex review..."

# Codex によるレビューを実行し、結果を plan.md に追記
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REVIEW_OUTPUT=$(copilot --model gpt-5.2-codex \
  --add-dir "$PROJECT_DIR" \
  --allow-all \
  -s \
  -p "Review the current code changes in this workspace (run 'git diff' and 'git diff --cached' to see them). List issues, suggestions, and positive findings. Be concise and specific.")

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
