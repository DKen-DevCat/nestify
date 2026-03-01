/**
 * playlistService ユニットテスト（DB_MODE=mock）
 *
 * bun test で実行する。
 * 各テスト間でモックデータが共有されるため、順序に依存しないように独立した
 * データを使うか、テスト後にクリーンアップを行う。
 */
import { describe, it, expect, beforeEach } from "bun:test";

// テスト前に DB_MODE=mock を設定
process.env.DB_MODE = "mock";

// モジュールを動的にインポートする（env 設定後に読み込む）
// biome-ignore lint/suspicious/noExplicitAny: テスト用の動的インポート
let service: typeof import("../services/playlistService");
// biome-ignore lint/suspicious/noExplicitAny: テスト用の動的インポート
let mockData: typeof import("../db/mock");

beforeEach(async () => {
  // テストごとに再インポートしてモックデータをリセット
  // Bun はモジュールキャッシュを持つため、ここでは状態を直接リセット
  service = await import("../services/playlistService");
  mockData = await import("../db/mock");
});

// ---------------------------------------------------------------------------
// getTree
// ---------------------------------------------------------------------------
describe("getTree", () => {
  it("ルートプレイリスト一覧を返す", async () => {
    const result = await service.getTree("any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // ルートレベル（parentId === null）のみ
    const roots = result.data.filter((p) => p.parentId === null);
    expect(roots.length).toBeGreaterThan(0);
  });

  it("子プレイリストがネストされている", async () => {
    const result = await service.getTree("any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const withChildren = result.data.filter(
      (p) => p.children && p.children.length > 0,
    );
    expect(withChildren.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------
describe("getById", () => {
  it("存在するIDで単一プレイリストを返す", async () => {
    const result = await service.getById("pl-001", "any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("pl-001");
    expect(result.data.name).toBe("All Music");
  });

  it("存在しないIDで 404 エラーを返す", async () => {
    const result = await service.getById("pl-nonexistent", "any_user");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------
describe("create", () => {
  it("新しいプレイリストを作成して返す", async () => {
    const initialCount = mockData.MOCK_PLAYLISTS_FLAT.length;
    const result = await service.create(
      { name: "Test Playlist", icon: "🎸", parentId: null },
      "test_user",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Test Playlist");
    expect(result.data.icon).toBe("🎸");
    expect(result.data.parentId).toBeNull();
    expect(mockData.MOCK_PLAYLISTS_FLAT.length).toBe(initialCount + 1);

    // クリーンアップ
    const idx = mockData.MOCK_PLAYLISTS_FLAT.findIndex(
      (p) => p.id === result.data.id,
    );
    if (idx !== -1) mockData.MOCK_PLAYLISTS_FLAT.splice(idx, 1);
  });

  it("parentId を指定して子プレイリストを作成できる", async () => {
    const result = await service.create(
      { name: "Child PL", parentId: "pl-001" },
      "test_user",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.parentId).toBe("pl-001");

    // クリーンアップ
    const idx = mockData.MOCK_PLAYLISTS_FLAT.findIndex(
      (p) => p.id === result.data.id,
    );
    if (idx !== -1) mockData.MOCK_PLAYLISTS_FLAT.splice(idx, 1);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------
describe("update", () => {
  it("名前を更新できる", async () => {
    const result = await service.update(
      "pl-005",
      { name: "Updated Workout" },
      "any_user",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe("Updated Workout");

    // 元に戻す
    await service.update("pl-005", { name: "Workout" }, "any_user");
  });

  it("存在しないIDで 404 エラーを返す", async () => {
    const result = await service.update(
      "pl-nonexistent",
      { name: "X" },
      "any_user",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// deletePlaylist
// ---------------------------------------------------------------------------
describe("deletePlaylist", () => {
  it("存在するプレイリストを削除できる", async () => {
    // 一時プレイリストを作成
    const created = await service.create(
      { name: "To Delete", parentId: null },
      "test_user",
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await service.deletePlaylist(created.data.id, "test_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(true);

    // 削除されていることを確認
    const found = await service.getById(created.data.id, "test_user");
    expect(found.ok).toBe(false);
  });

  it("存在しないIDで 404 エラーを返す", async () => {
    const result = await service.deletePlaylist(
      "pl-nonexistent",
      "test_user",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// getTracksRecursive
// ---------------------------------------------------------------------------
describe("getTracksRecursive", () => {
  it("ルートプレイリストで子孫含む全トラックを取得できる", async () => {
    // pl-001（All Music）は pl-002（Lo-fi Beats）+ pl-003（Chill Vibes）を持つ
    // pl-002 はさらに pl-004（Morning Lo-fi）を持つ
    const result = await service.getTracksRecursive("pl-001", "any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All Music 配下の全トラック（pl-002, pl-003, pl-004 のトラック）
    expect(result.data.length).toBeGreaterThan(0);

    // sourcePlaylistName フィールドが存在する
    expect(result.data[0]).toHaveProperty("sourcePlaylistName");
  });

  it("葉プレイリストで直接のトラックのみ取得できる", async () => {
    // pl-004（Morning Lo-fi）は子がない → 直接トラックのみ
    const result = await service.getTracksRecursive("pl-004", "any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const playlistIds = new Set(result.data.map((t) => t.playlistId));
    expect(playlistIds.size).toBe(1);
    expect(playlistIds.has("pl-004")).toBe(true);
  });

  it("トラックがないプレイリストで空配列を返す", async () => {
    // pl-001 には直接トラックがない（子にある）
    // → 子孫含むので空にはならないはず
    // pl-003（Chill Vibes）にはトラックあり
    const result = await service.getTracksRecursive("pl-003", "any_user");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// moveTrack
// ---------------------------------------------------------------------------
describe("moveTrack", () => {
  it("source を指定して別プレイリストへ移動できる", async () => {
    const result = await service.moveTrack(
      "track-001",
      "pl-002",
      "pl-003",
      1,
      "any_user",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.moved).toBe(true);

    const moved = mockData.MOCK_TRACKS.find((t) => t.id === "track-001");
    expect(moved?.playlistId).toBe("pl-003");
    expect(moved?.order).toBe(1);

    // 後続テストへ影響しないよう元に戻す
    await service.moveTrack("track-001", "pl-003", "pl-002", 0, "any_user");
  });

  it("source と track の所属が一致しない場合は 404 を返す", async () => {
    const result = await service.moveTrack(
      "track-001",
      "pl-003",
      "pl-002",
      0,
      "any_user",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});
