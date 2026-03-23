// RED phase test: MergeableBadge.svelte
// 配置先: src/test/sidepanel/components/MergeableBadge.test.ts
//
// 前提:
//   - MergeableStatus 型が src/shared/types/wasm.ts から export されていること
//   - MergeableBadge.svelte が src/sidepanel/components/ に存在すること

import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { MergeableStatus } from "../../../shared/types/wasm";
import MergeableBadge from "../../../sidepanel/components/MergeableBadge.svelte";

/** テスト専用: 型チェックを迂回して不正値を注入する */
function unsafeCast<T>(value: unknown): T {
	return value as T;
}

describe("MergeableBadge", () => {
	let component: ReturnType<typeof mount>;

	afterEach(() => {
		if (component) {
			unmount(component);
		}
		document.body.innerHTML = "";
	});

	it("should render CONFLICT badge with red class when status is Conflicting", () => {
		component = mount(MergeableBadge, {
			target: document.body,
			props: { mergeableStatus: "Conflicting" },
		});
		const badge = document.querySelector(".badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent?.trim()).toBe("CONFLICT");
		expect(badge?.classList.contains("badge-red")).toBe(true);
		expect(badge?.classList.contains("badge-animate")).toBe(false);
	});

	it("should render CHECKING... badge with gray class and animation when status is Unknown", () => {
		component = mount(MergeableBadge, {
			target: document.body,
			props: { mergeableStatus: "Unknown" },
		});
		const badge = document.querySelector(".badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent?.trim()).toBe("CHECKING...");
		expect(badge?.classList.contains("badge-gray")).toBe(true);
		expect(badge?.classList.contains("badge-animate")).toBe(true);
	});

	it("should render nothing when status is Mergeable (normal state, no noise)", () => {
		component = mount(MergeableBadge, {
			target: document.body,
			props: { mergeableStatus: "Mergeable" },
		});
		const badge = document.querySelector(".badge");
		expect(badge).toBeNull();
	});

	it("should render nothing when status is an empty string", () => {
		component = mount(MergeableBadge, {
			target: document.body,
			props: { mergeableStatus: unsafeCast<MergeableStatus>("") },
		});
		const badge = document.querySelector(".badge");
		expect(badge).toBeNull();
	});

	it("should render nothing when status is an unknown value", () => {
		component = mount(MergeableBadge, {
			target: document.body,
			props: { mergeableStatus: unsafeCast<MergeableStatus>("InvalidValue") },
		});
		const badge = document.querySelector(".badge");
		expect(badge).toBeNull();
	});
});
