import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { PrItemDto } from "../../../domain/ports/pr-processor.port";
import PrSection from "../../../sidepanel/components/PrSection.svelte";

function createPrItemDto(overrides: Partial<PrItemDto> = {}): PrItemDto {
	return {
		id: "PR_123",
		number: 42,
		title: "Add feature X",
		author: "octocat",
		url: "https://github.com/owner/repo/pull/42",
		repository: "owner/repo",
		isDraft: false,
		approvalStatus: "ReviewRequired",
		ciStatus: "Passed",
		mergeableStatus: "Unknown",
		additions: 10,
		deletions: 3,
		createdAt: "2026-03-20T10:00:00Z",
		updatedAt: "2026-03-23T10:00:00Z",
		sizeLabel: "S",
		unresolvedCommentCount: 0,
		...overrides,
	};
}

describe("PrSection active highlight", () => {
	let component: ReturnType<typeof mount>;

	afterEach(() => {
		if (component) {
			unmount(component);
		}
		document.body.innerHTML = "";
	});

	it("should add .active class to the PR item whose URL matches activeTabUrl", () => {
		const pr = createPrItemDto({
			url: "https://github.com/owner/repo/pull/42",
		});

		component = mount(PrSection, {
			target: document.body,
			props: {
				title: "My PRs",
				items: [pr],
				activeTabUrl: "https://github.com/owner/repo/pull/42",
			},
		});

		const prItem = document.querySelector(".pr-item");
		expect(prItem).not.toBeNull();
		expect(prItem?.classList.contains("active")).toBe(true);
	});

	it("should not add .active class when activeTabUrl does not match any PR", () => {
		const pr = createPrItemDto({
			url: "https://github.com/owner/repo/pull/42",
		});

		component = mount(PrSection, {
			target: document.body,
			props: {
				title: "My PRs",
				items: [pr],
				activeTabUrl: "https://github.com/other/repo/pull/99",
			},
		});

		const prItem = document.querySelector(".pr-item");
		expect(prItem).not.toBeNull();
		expect(prItem?.classList.contains("active")).toBe(false);
	});

	it("should not add .active class to any PR item when activeTabUrl is undefined", () => {
		const pr1 = createPrItemDto({
			id: "PR_1",
			number: 1,
			url: "https://github.com/owner/repo/pull/1",
		});
		const pr2 = createPrItemDto({
			id: "PR_2",
			number: 2,
			url: "https://github.com/owner/repo/pull/2",
		});

		component = mount(PrSection, {
			target: document.body,
			props: {
				title: "My PRs",
				items: [pr1, pr2],
				// activeTabUrl は渡さない (undefined)
			},
		});

		const prItems = document.querySelectorAll(".pr-item");
		expect(prItems).toHaveLength(2);
		for (const item of prItems) {
			expect(item.classList.contains("active")).toBe(false);
		}
	});

	it("should highlight only the matching PR among multiple items", () => {
		const pr1 = createPrItemDto({
			id: "PR_1",
			number: 1,
			title: "First PR",
			url: "https://github.com/owner/repo/pull/1",
		});
		const pr2 = createPrItemDto({
			id: "PR_2",
			number: 2,
			title: "Second PR",
			url: "https://github.com/owner/repo/pull/2",
		});
		const pr3 = createPrItemDto({
			id: "PR_3",
			number: 3,
			title: "Third PR",
			url: "https://github.com/owner/repo/pull/3",
		});

		component = mount(PrSection, {
			target: document.body,
			props: {
				title: "My PRs",
				items: [pr1, pr2, pr3],
				activeTabUrl: "https://github.com/owner/repo/pull/2",
			},
		});

		const prItems = document.querySelectorAll(".pr-item");
		expect(prItems).toHaveLength(3);

		// PR #2 だけが .active
		expect(prItems[0]?.classList.contains("active")).toBe(false);
		expect(prItems[1]?.classList.contains("active")).toBe(true);
		expect(prItems[2]?.classList.contains("active")).toBe(false);
	});

	it("should match PR URL even when activeTabUrl has sub-path (e.g. /files)", () => {
		// activeTabUrl が "https://github.com/owner/repo/pull/42/files" の場合、
		// extractPrBaseUrl で "https://github.com/owner/repo/pull/42" に正規化されてマッチする
		const pr = createPrItemDto({
			url: "https://github.com/owner/repo/pull/42",
		});

		component = mount(PrSection, {
			target: document.body,
			props: {
				title: "My PRs",
				items: [pr],
				activeTabUrl: "https://github.com/owner/repo/pull/42/files",
			},
		});

		const prItem = document.querySelector(".pr-item");
		expect(prItem).not.toBeNull();
		expect(prItem?.classList.contains("active")).toBe(true);
	});
});
