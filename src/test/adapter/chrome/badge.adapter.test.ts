import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createChromeBadgeAdapter } from "../../../adapter/chrome/badge.adapter";
import type { BadgePort } from "../../../domain/ports/badge.port";
import { getChromeMock, resetChromeMock, setupChromeMock } from "../../mocks/chrome.mock";

describe("ChromeBadgeAdapter", () => {
	let adapter: BadgePort;

	beforeEach(() => {
		setupChromeMock();
		adapter = createChromeBadgeAdapter();
	});

	afterEach(() => {
		resetChromeMock();
	});

	describe("setBadgeText", () => {
		it("should call chrome.action.setBadgeText with correct text", async () => {
			await adapter.setBadgeText("3");

			const mock = getChromeMock();
			expect(mock.action.setBadgeText).toHaveBeenCalledWith({ text: "3" });
		});

		it("should call chrome.action.setBadgeText with empty string to clear badge", async () => {
			await adapter.setBadgeText("");

			const mock = getChromeMock();
			expect(mock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
		});
	});

	describe("setBadgeBackgroundColor", () => {
		it("should call chrome.action.setBadgeBackgroundColor with correct color", async () => {
			await adapter.setBadgeBackgroundColor("#FF0000");

			const mock = getChromeMock();
			expect(mock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#FF0000" });
		});
	});
});
