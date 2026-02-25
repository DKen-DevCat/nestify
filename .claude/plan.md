# Claude Code 作業完了後に Codex レビューを自動依頼する方法

> 調査日: 2026-02-21
> ステータス: Complete
> タグ: #ClaudeCode #CopilotCLI #GPT-5.2-Codex #Hooks #自動化
> 信頼性スコア: ⭐⭐⭐⭐☆ (4/5)

## エグゼクティブサマリー

**Claude Code の Hooks 機能（Stop イベント）で「応答終了時」にコマンドを実行し、そのコマンド内で GitHub Copilot CLI をプログラムモード（`-p`）で呼び出すことで、指示なしに Codex によるコードレビューを自動起動できる。** 設定は `.claude/settings.json` または `.claude/settings.local.json` に記述する。

---

## 調査目的

- Claude Code で実装し、GitHub Copilot CLI（gpt-5.2-codex）でレビューする運用をしている。
- 作業完了のたびに手動で Codex にレビュー依頼する手間を省きたい。
- **「指示せずとも、作業完了後に自動で Claude Code が Codex にレビュー依頼する」** 方法を特定する。

---

## 調査結果

### 主要な発見

| 発見                            | 説明                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Claude Code Hooks            | 特定イベント時に任意コマンドを実行できる。**Stop** が「応答終了時」に相当し、タスク完了後の自動トリガーに使える。 |
| 2. Copilot CLI プログラムモード | `copilot -p "プロンプト"` で非対話実行可能。`--model gpt-5.2-codex` でモデル指定。                                |
| 3. レビュー依頼の仕方           | 対話型の `/review` に相当する処理を、`-p` に「変更をレビューして」と渡すプロンプトで依頼できる。                  |
| 4. 非対話で必要なオプション     | ツール承認を避けるため `--allow-all` または `--allow-tool` の指定が推奨。`--add-dir` で対象ディレクトリを渡す。   |

### 仕組みの流れ

```
Claude Code が応答を終了
        ↓
Stop フックが発火
        ↓
設定されたコマンド実行（例: シェルスクリプト）
        ↓
copilot --model gpt-5.2-codex --add-dir "$CLAUDE_PROJECT_DIR" \
  --allow-all -s -p "Review the current code changes (git diff). ..."
        ↓
Codex が変更を分析し、結果を出力
```

### Claude Code Hooks の要点

- **設定ファイルの場所**（優先度の高い順）
  - プロジェクト: `.claude/settings.local.json`（コミットしない）
  - プロジェクト: `.claude/settings.json`
  - ユーザー共通: `~/.claude/settings.json`
- **Stop イベント**
  - メインエージェントが応答を終了したときに実行される。
  - **ユーザー割り込みで停止した場合は実行されない**（公式ドキュメント）。
- **実行環境**
  - `$CLAUDE_PROJECT_DIR` が利用可能（Claude Code が起動したプロジェクトルート）。
- **コマンド実行**
  - `type: "command"` で bash コマンドまたはスクリプトを指定可能。

### GitHub Copilot CLI の要点

| 項目             | 内容                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| プログラムモード | `-p PROMPT` / `--prompt PROMPT` でプロンプトを渡すと完了後に終了。                                                                                    |
| モデル指定       | `--model gpt-5.2-codex` で Codex を指定。                                                                                                             |
| ディレクトリ指定 | `--add-dir PATH` でレビュー対象の作業ディレクトリを渡す。                                                                                             |
| 非対話実行       | `--allow-all` または `--allow-tool read` 等でツール許可。`-s`/`--silent` で応答のみ出力可能。                                                         |
| 対話型の /review | スラッシュコマンド `/review [PROMPT]` は「コードレビューエージェントで変更を分析」。`-p` では「変更をレビューして」等のプロンプトで同等の依頼が可能。 |

---

## 実装方法

### 1. Hook で実行するコマンドの選び方

- **A. 設定ファイルに直接コマンドを書く**
  - 短いワンライナー向け。長いと可読性・保守性が落ちる。
- **B. プロジェクトのスクリプトを呼ぶ（推奨）**
  - `$CLAUDE_PROJECT_DIR` を使い、`.claude/scripts/trigger-codex-review.sh` などを実行。
  - ログ出力・条件分岐（差分があるときだけ実行など）をまとめられる。

### 2. 設定例（.claude/settings.local.json）

プロジェクト単位で使う場合（他メンバーに影響したくない場合は `.claude/settings.local.json` に記載）。  
本リポジトリには `.claude/settings.local.json.example` と `.claude/scripts/trigger-codex-review.sh` を同梱している。有効化するには example を `settings.local.json` にコピーし、スクリプトを実行可能にすること。

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/scripts/trigger-codex-review.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

- `matcher` が空のため、すべての Stop で実行される。
- `timeout` はレビュー完了までの余裕を持って 120 秒などに設定。

### 3. トリガースクリプト例（.claude/scripts/trigger-codex-review.sh）

```bash
#!/usr/bin/env bash
set -e
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# 変更が無い場合はスキップ（任意）
if ! git -C "$PROJECT_DIR" diff --quiet 2>/dev/null || ! git -C "$PROJECT_DIR" diff --cached --quiet 2>/dev/null; then
  :
else
  echo "No git changes; skipping Codex review."
  exit 0
fi

# Copilot CLI がインストール済みである前提
copilot --model gpt-5.2-codex \
  --add-dir "$PROJECT_DIR" \
  --allow-all \
  -s \
  -p "Review the current code changes in this workspace (e.g. run 'git diff' or 'git status' to see them). List issues, suggestions, and positive findings. Be concise."

exit 0
```

- `copilot` は PATH が通っていること。未導入の場合は Homebrew 等でインストール。
- 変更が無い場合はスキップする例。不要なら `if` ブロックを削除して常時実行してもよい。

### 4. スクリプトを置かずに設定だけにする場合

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && copilot --model gpt-5.2-codex --add-dir \"$CLAUDE_PROJECT_DIR\" --allow-all -s -p \"Review the current code changes. List issues and suggestions.\"",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

- JSON 内の `"` は `\"` でエスケープ。
- 長いコマンドはスクリプトに逃がした方が管理しやすい。

---

## 比較・トレードオフ

| 方式                         | メリット                                     | デメリット                                                   |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Stop フックで毎回実行        | 確実に「応答終了のたび」にレビュー依頼できる | 応答終了＝必ずしもタスク完了ではない（会話の区切りでも発火） |
| git diff ありのときだけ実行  | 無駄な Copilot 呼び出しを減らせる            | スクリプトで条件分岐が必要                                   |
| ユーザー設定（~/.claude）    | 全プロジェクトで共通                         | プロジェクトごとの切り替えがしづらい                         |
| プロジェクト設定（.claude/） | リポジトリごとに有効/無効を制御できる        | 設定をコミットするかどうかの方針が必要                       |

---

## 結論・推奨事項

### 結論

- **Claude Code の Stop フックから Copilot CLI をプログラムモードで呼び出す**ことで、**ユーザーが明示的に指示しなくても、応答終了後に Codex によるレビュー依頼を自動実行できる**。
- 実運用では「プロジェクト用スクリプト + .claude/settings.local.json の Stop フック」で、差分があるときだけ実行する形を推奨する。

### 推奨アクション

1. **Copilot CLI のインストール確認**
   - `copilot --version` や `copilot help` が動くこと、および `gpt-5.2-codex` が利用可能なサブスクリプションであることを確認する。
2. **スクリプトの配置**
   - 上記の `trigger-codex-review.sh` を `.claude/scripts/` に配置し、`chmod +x` で実行可能にする。
3. **Hook の登録**
   - `.claude/settings.local.json` に Stop フックを追加（上記設定例をベースに必要に応じて調整）。
4. **動作確認**
   - Claude Code で小さな変更をして応答を終了し、Codex が起動してレビュー結果が出力されるか確認する。
   - 問題があれば `claude --debug` でフック実行ログを確認する。

### 注意点・制限事項

- **Stop は「応答終了」のたびに発火する**ため、「タスク完了時のみ」とは限らない。会話の区切りや途中で止めた場合も（割り込みでない限り）実行される。必要ならスクリプト内で「直近のメッセージがタスク完了を示すか」などでフィルタする検討の余地あり。
- **ユーザー割り込みで停止した場合は Stop は実行されない**（公式ドキュメント）。
- Copilot CLI の**プログラムモードではツール承認が表示されない**ため、`--allow-all` または適切な `--allow-tool` を付与する必要がある。
- **Claude Code の設定変更は `/hooks` メニューで反映を確認する**必要がある場合がある。スタートアップ時にフックのスナップショットが読み込まれる。
- 信頼性スコア 4/5 の理由: `-p` で「レビュー」を依頼したときの挙動は公式に「/review と同等」とは明示されていないため、実際の出力は手元で一度確認することを推奨。

### Skills 作成への示唆

- 本調査は「Claude Code の skills 作成」の一環として依頼されている。自動レビュー連携は **Hooks** で実現するため、Skill の YAML 内に `hooks:` を定義する方法も取れる（Skills/Agents では `PreToolUse` / `PostToolUse` / `Stop` をスコープに持てる）。
- チームで「実装後に必ず Codex レビュー」を標準化したい場合は、**プロジェクトの `.claude/settings.json` に Stop フックを置き、スクリプトを `.claude/scripts/` にコミットする**形にすると、Skill 単体ではなくワークフローとして共有しやすい。

---

## 参考資料

### 一次情報（公式）

- [Hooksリファレンス - Claude Code Docs](https://docs.claude.com/ja/docs/claude-code/hooks) - 取得日: 2026-02-21
- [GitHub Copilot CLI の使用 - GitHub Docs](https://docs.github.com/ja/enterprise-cloud@latest/copilot/how-tos/use-copilot-agents/use-copilot-cli) - 取得日: 2026-02-21
- [GitHub Copilot CLI コマンド リファレンス - GitHub Docs](https://docs.github.com/ja/enterprise-cloud@latest/copilot/reference/cli-command-reference) - 取得日: 2026-02-21

### 二次情報

- [Claude CodeのHooksでタスクが終わる時に自動Slack通知を設定してみた | DevelopersIO](https://dev.classmethod.jp/articles/claude-code-hooks-notify-slack-when-task-is-finished/) - 取得日: 2026-02-21
- [【完全ガイド】Claude Code Hooks で開発ワークフローを自動化する ── 全14イベント徹底解説 - Qiita](https://qiita.com/nogataka/items/17fc8d9c2b2efde570a6) - 取得日: 2026-02-21
- [技術調査 - GitHub Copilot CLI - Zenn](https://zenn.dev/suwash/articles/github_copilot_cli_20251216) - 取得日: 2026-02-21

---

## Codex レビュー — 2026-02-21 12:36:53

Issues: `.claude/tasks.md` includes a stray `# test` line; remove unless intentional.  
Suggestions: If this was just a local note, keep it out of tracked files.  
Positive: No other working tree or staged changes detected.

> ステータス: 対応完了（tasks.md の不要な `# test` 行を削除）

---

## Codex レビュー — 2026-02-21 13:03:06

Issues: None found; changes are straightforward. Suggestions: In `trigger-codex-review.sh`, you can simplify the commit check by testing `git rev-parse --verify HEAD >/dev/null 2>&1` instead of counting `log` lines, but current logic is OK. Positive findings: Script now correctly reviews the latest commit even when no diffs exist, and tasks.md clearly records Phase 1 completion with detailed checklist.

> ステータス: 対応完了（`rev-parse --verify HEAD` を使う提案を適用してスクリプトを修正）

---

## Codex レビュー — 2026-02-24 16:56:13

Issues: robots.ts uses both disallow "/" and allow "/login" for the same user agent; this can be ambiguous depending on crawler precedence (consider ordering or a single rule with allow/disallow). The new openGraph image and metadata hardcode a deployment URL; confirm this is the canonical production domain to avoid incorrect metadata in other environments.  
Suggestions: Consider adding `openGraph.images` in layout metadata to explicitly point to `/opengraph-image` (ensures OG image even if auto inference fails); if `/login` is the only public route, add `robots` at app root and keep route-level overrides consistent.  
Positive: SEO metadata and PWA manifest additions are comprehensive; login page metadata and explicit `noindex` on private areas are clear and consistent.

> ステータス: 対応完了（robots.ts 単一ルール化・OG images 明示・SITE_URL 環境変数化）

---

## Codex レビュー — 2026-02-24 18:24:11

Unstaged and staged diffs are empty; latest commit updates .claude/settings.local.json.example with a full permissions allow/deny/ask block (adds Edit/Write and Bash patterns) and .claude/tasks.md with a permissions-fix checklist. Issues: none obvious; Suggestion: confirm the broadened Bash allow patterns (e.g., chmod *, cd * && bun *) are appropriate even in an example file; Positive: clearer onboarding and documented rationale.

> ステータス: 対応完了（Issues なし / Suggestion 確認済み — Bash パターンは開発フロー上適切と判断）

---

## Codex レビュー — 2026-02-24 18:33:20

Unstaged changes: none. Staged changes: none. Latest commit only updates `.claude/plan.md` and `.claude/tasks.md` with review notes; no code changes.  
Issues: none found. Suggestions: consider whether `.claude/plan.md`/`.claude/tasks.md` should be tracked in commits to avoid cluttering history. Positives: review trail is documented and clearly summarizes rationale.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 18:36:10

Unstaged: none. Staged: none. Latest commit only updates `.claude/plan.md` and `.claude/tasks.md` with review notes (no code changes).
Issues: none found. Suggestions: consider whether committing `.claude/plan.md` and `.claude/tasks.md` each review is desirable vs. keeping history clean.
Positives: review trail is documented clearly with rationale and status.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 18:39:57

Unstaged: none. Staged: none.  
Latest commit: only updates `.claude/plan.md` and `.claude/tasks.md` with review notes; no code changes.  
Issues: none. Suggestions: ensure committing `.claude/plan.md`/`.claude/tasks.md` each review is intended for history noise. Positives: clear review trail and rationale documented.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 18:44:25

Unstaged: none. Staged: none. Latest commit only adds review notes in .claude/plan.md and .claude/tasks.md; no code changes—Issues: none. Suggestion: confirm committing .claude review logs each time is intentional to avoid history noise; Positive: review trail is clearly documented.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 18:47:57

Unstaged changes: none. Staged changes: none.  
Latest commit only adds review notes in `.claude/plan.md` and `.claude/tasks.md`; Issues: none. Suggestions: confirm committing `.claude` review logs each time is intentional to avoid history noise. Positives: clear review trail and rationale are documented.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 23:51:44

Unstaged: none. Staged: none.  
Latest commit only updates `.claude/plan.md` and `.claude/tasks.md` with review notes; **Issues:** none. **Suggestion:** confirm that committing `.claude` review logs each time is intentional to avoid history noise. **Positive:** review trail and rationale are clearly documented.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-24 23:56:06

Issues: none (no unstaged or staged changes; latest commit only updates `.claude/plan.md` and `.claude/tasks.md`). Suggestions: confirm committing `.claude` review logs each time is intentional to avoid history noise. Positives: review trail and rationale are clearly documented.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-25 00:11:56

Issues: Unstaged changes add `AbortSignal.timeout(10_000)` to Spotify fetches; if the runtime lacks this API or abort errors aren’t handled, calls may now reject unexpectedly. Suggestions: confirm Node runtime support for `AbortSignal.timeout` (or add a fallback) and consider explicit handling/logging of abort errors; decide whether `retry: 1` in `usePlaylistTracks` aligns with desired UX. Positives: timeouts improve resiliency against hung Spotify calls, and reducing retries limits unnecessary load.

> ステータス: 対応完了（abort エラーを `.catch((): null => null)` で Result に変換、retry: 1 は意図的設計として維持）

---

## Codex レビュー — 2026-02-25 00:42:39

Unstaged: none; staged: none. Issues: NowPlayingBar reads playerStore but nothing sets currentTrack, so it will stay on “再生していません” with disabled controls; Suggestions: wire track click/selection to playTrack (and sourcePlaylistId) and add aria-labels to icon-only controls; Positives: cohesive Spotify-style theming and layout refactor with fixed playback bar + sticky headers.

> ステータス: 対応完了（playTrack 接続・アクティブハイライト・aria-label 追加）

---

## Codex レビュー — 2026-02-25 10:11:08

Issues: the sticky header is always in the layout (opacity/pointerEvents only), so it likely leaves a blank spacer above the hero even when hidden; addedIds is global across target playlist selection, so a track added to one child can’t be added to another without closing/reopening. Suggestions: conditionally render the sticky header or collapse its height when hidden, and scope addedIds per target (or clear on target change) plus surface addTrack failures with feedback. Positives: the inline search adds debounced queries with clear empty/error states, the retry button improves recoverability, and the compact header UX is a nice navigation upgrade.

> ステータス: 対応完了（スティッキーヘッダー条件レンダリング化・addedIds スコープ修正・addTrack 失敗フィードバック追加）

---

## Codex レビュー — 2026-02-25 10:19:47

Issues: none found in the latest diff; no obvious regressions from the UI state changes.  
Suggestions: add `aria-live="polite"` to the addError message for accessibility, and if the abrupt hide feels jarring consider a small exit transition on the sticky header (e.g., CSS opacity on unmount).  
Positives: conditional rendering removes the sticky-header spacer, addedIds reset fixes cross-playlist blocking, error feedback improves UX, and the review docs are updated.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-25 13:46:35

Unstaged changes: none; staged changes: none. Issues: none found in the latest commit; Suggestions: consider adding `aria-hidden` to `Skeleton` placeholders and hoist static skeleton row configs out of render to avoid re-creation. Positives: skeletons mirror real layout to prevent CLS, reuse the existing shimmer keyframe via `.animate-skeleton`, and introduce a reusable `Skeleton` component.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-25 14:05:35

Unstaged changes: none. Staged changes: none.  
**Issues:** none found in the latest commit. **Suggestions:** add `aria-label` on icon-only buttons (labels hidden on small screens) for accessibility. **Positives:** clean removal of NowPlayingBar/playerStore and play interactions, plus sticky header action buttons with proper disabled/loader states.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-25 14:26:49

Unstaged changes: none. Staged changes: none. Latest commit only updates .claude/plan.md and .claude/tasks.md with review notes; **Issues:** none; **Suggestions:** none necessary (docs-only change); **Positives:** clear audit trail of review status and decisions.

> ステータス: 対応完了（Issues なし）

---

## Codex レビュー — 2026-02-25 14:34:07

Unstaged changes: `.claude/plan.md` only; staged changes: none.
Issue: `InlineTrackSearch.tsx` has a stray `2m` inserted in the JSX button line (`aria-label` block) which will cause a syntax/build error.
Suggestions/positives: consider restoring autofocus if desired for UX; positives include always-visible search bar with conditional results panel and cleanup of add-track toggle/buttons in `PlaylistDetailView`.

> ステータス: 対応済み — stray `2m` はアルバム検索機能実装時の全面書き換えで解消

---

## Codex レビュー — 2026-02-25 14:34:59

Issues: none detected in the latest commit; unstaged change only .claude/plan.md (review notes), staged none.
Suggestions: consider adding an explicit aria-label to the search input (placeholder-only label) and optionally focus the input on mount if quick entry is desired.
Positives: always-visible search bar with conditional results panel, simplified playlist actions by removing add-track toggles, and empty-state/skeleton updates aligned to the new flow.

> ステータス: 対応済み — search input に aria-label="曲・アルバムを検索" を追加

---

## Codex レビュー — 2026-02-25 15:38:36

Issues: none found in unstaged/staged changes or the latest commit diff. Suggestions: none required; optionally confirm `.claude` review notes are intended to be versioned. Positives: adds an `aria-label` to the search input for accessibility and records review status updates in `.claude/plan.md` and `.claude/tasks.md`.

> ステータス: 対応完了（Issues なし）
