import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDebugEntries, getDebugEntries, logDebug } from "../../../shared/utils/debug-logger";
import { resetChromeMock, setupChromeMock } from "../../mocks/chrome.mock";

describe("debug-logger", () => {
	/** chrome.storage.local のインメモリストア */
	let storageData: Record<string, unknown>;

	beforeEach(() => {
		const mock = setupChromeMock();
		storageData = {};

		mock.storage.local.get.mockImplementation(async (key: string) => {
			return { [key]: storageData[key] };
		});
		mock.storage.local.set.mockImplementation(async (items: Record<string, unknown>) => {
			Object.assign(storageData, items);
		});
		mock.storage.local.remove.mockImplementation(async (key: string) => {
			delete storageData[key];
		});
	});

	afterEach(() => {
		resetChromeMock();
		vi.restoreAllMocks();
	});

	it("log() はエントリを chrome.storage.local に保存する", async () => {
		await logDebug("info", "test-source", "hello");

		const entries = await getDebugEntries();
		expect(entries).toHaveLength(1);
		expect(entries[0].source).toBe("test-source");
		expect(entries[0].message).toBe("hello");
	});

	it("getEntries() は保存されたエントリ配列を返す", async () => {
		await logDebug("info", "src-a", "msg-1");
		await logDebug("warn", "src-b", "msg-2");

		const entries = await getDebugEntries();
		expect(entries).toHaveLength(2);
		expect(entries[0].message).toBe("msg-1");
		expect(entries[1].message).toBe("msg-2");
	});

	it("100件を超えたとき最も古いエントリが削除される（リングバッファ動作）", async () => {
		for (let i = 0; i < 105; i++) {
			await logDebug("info", "bulk", `msg-${i}`);
		}

		const entries = await getDebugEntries();
		expect(entries).toHaveLength(100);
		// 最も古い 0-4 は削除され、5 が先頭になる
		expect(entries[0].message).toBe("msg-5");
		expect(entries[99].message).toBe("msg-104");
	});

	it("clear() は全エントリを削除する", async () => {
		await logDebug("info", "src", "will be cleared");
		await clearDebugEntries();

		const entries = await getDebugEntries();
		expect(entries).toHaveLength(0);
	});

	it("log() のエントリに timestamp, level, source, message が含まれる", async () => {
		await logDebug("error", "my-source", "something broke", "detail info");

		const entries = await getDebugEntries();
		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(entry.level).toBe("error");
		expect(entry.source).toBe("my-source");
		expect(entry.message).toBe("something broke");
		expect(entry.detail).toBe("detail info");
	});

	it("getEntries() は storage が空のとき空配列を返す", async () => {
		const entries = await getDebugEntries();
		expect(entries).toHaveLength(0);
	});
});
