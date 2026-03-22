import type { AlarmPort } from "../../domain/ports/alarm.port";

export class ChromeAlarmAdapter implements AlarmPort {
	create(_name: string, _periodInMinutes: number): void {
		throw new Error("Not implemented");
	}

	clear(_name: string): Promise<boolean> {
		throw new Error("Not implemented");
	}

	onAlarm(_callback: (name: string) => void): () => void {
		throw new Error("Not implemented");
	}
}
