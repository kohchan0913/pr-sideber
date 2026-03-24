import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import UnresolvedCommentBadge from "../../../sidepanel/components/UnresolvedCommentBadge.svelte";

describe("UnresolvedCommentBadge", () => {
	let component: ReturnType<typeof mount>;

	afterEach(() => {
		if (component) {
			unmount(component);
		}
		document.body.innerHTML = "";
	});

	it("should render nothing when count is 0", () => {
		component = mount(UnresolvedCommentBadge, {
			target: document.body,
			props: { count: 0 },
		});
		const badge = document.querySelector(".badge");
		expect(badge).toBeNull();
	});

	it("should render badge with count when count is 1", () => {
		component = mount(UnresolvedCommentBadge, {
			target: document.body,
			props: { count: 1 },
		});
		const badge = document.querySelector(".badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent?.trim()).toContain("1");
	});

	it("should render badge with count when count is 99", () => {
		component = mount(UnresolvedCommentBadge, {
			target: document.body,
			props: { count: 99 },
		});
		const badge = document.querySelector(".badge");
		expect(badge).not.toBeNull();
		expect(badge?.textContent?.trim()).toContain("99");
	});

	it("should include a comment icon", () => {
		component = mount(UnresolvedCommentBadge, {
			target: document.body,
			props: { count: 3 },
		});
		const badge = document.querySelector(".badge");
		expect(badge).not.toBeNull();
		// コメントアイコン (💬 or SVG) が存在することを確認
		expect(badge?.textContent?.trim()).toMatch(/💬\s*3|3\s*💬/);
	});
});
