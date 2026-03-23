import type { BadgePort } from "../../domain/ports/badge.port";

export function createChromeBadgeAdapter(): BadgePort {
	return {
		async setBadgeText(text: string): Promise<void> {
			await chrome.action.setBadgeText({ text });
		},
		async setBadgeBackgroundColor(color: string): Promise<void> {
			await chrome.action.setBadgeBackgroundColor({ color });
		},
	};
}
