export interface BadgePort {
	setBadgeText(text: string): Promise<void>;
	setBadgeBackgroundColor(color: string): Promise<void>;
}
