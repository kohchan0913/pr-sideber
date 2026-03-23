import type { BadgePort } from "../../domain/ports/badge.port";

const BADGE_COLOR = "#1976D2";
const MAX_DISPLAY_COUNT = 99;

export function createBadgeUseCase(badge: BadgePort): {
	updateBadge(reviewRequestCount: number): Promise<void>;
} {
	async function updateBadge(reviewRequestCount: number): Promise<void> {
		if (!Number.isFinite(reviewRequestCount) || reviewRequestCount < 0) {
			await badge.setBadgeText("");
			return;
		}
		const count = Math.floor(reviewRequestCount);
		if (count === 0) {
			await badge.setBadgeText("");
			return;
		}
		const text = count > MAX_DISPLAY_COUNT ? "99+" : String(count);
		await badge.setBadgeBackgroundColor(BADGE_COLOR);
		await badge.setBadgeText(text);
	}

	return { updateBadge };
}
