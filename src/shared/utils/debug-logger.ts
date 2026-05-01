export interface DebugLogEntry {
	readonly timestamp: string;
	readonly level: "info" | "warn" | "error";
	readonly source: string;
	readonly message: string;
	readonly detail?: string;
}

const STORAGE_KEY = "debugLogs";
const MAX_LOG_ENTRIES = 100;

export async function logDebug(
	level: DebugLogEntry["level"],
	source: string,
	message: string,
	detail?: string,
): Promise<void> {
	const entry: DebugLogEntry = {
		timestamp: new Date().toISOString(),
		level,
		source,
		message,
		detail,
	};
	const entries = await getDebugEntries();
	const updated = [...entries, entry].slice(-MAX_LOG_ENTRIES);
	await chrome.storage.local.set({ [STORAGE_KEY]: updated });
}

export async function getDebugEntries(): Promise<readonly DebugLogEntry[]> {
	const result = await chrome.storage.local.get(STORAGE_KEY);
	return (result[STORAGE_KEY] as DebugLogEntry[] | undefined) ?? [];
}

export async function clearDebugEntries(): Promise<void> {
	await chrome.storage.local.remove(STORAGE_KEY);
}
