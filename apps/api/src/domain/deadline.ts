export function calculateDeadline(arrivalDate: Date, reviewWindowDays: number): Date {
	const deadline = new Date(arrivalDate);

	deadline.setUTCDate(deadline.getUTCDate() + reviewWindowDays);

	return deadline;
}

export const APPROACHING_DEADLINE_HOURS = 48;

export function utcDateOnly(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Latest date-only deadline with timeRemainingHours(deadline, now) < 0. */
export function maxPastDeadlineDate(now: Date): Date {
	const today = utcDateOnly(now);

	if (today.getTime() < now.getTime()) {
		return today;
	}

	const yesterday = new Date(today);

	yesterday.setUTCDate(yesterday.getUTCDate() - 1);

	return yesterday;
}

/** Earliest date-only deadline with timeRemainingHours(deadline, now) >= 0. */
export function minApproachingDeadlineDate(now: Date): Date {
	const today = utcDateOnly(now);

	if (today.getTime() >= now.getTime()) {
		return today;
	}

	const tomorrow = new Date(today);

	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

	return tomorrow;
}

/** Latest date-only deadline with timeRemainingHours(deadline, now) < hoursThreshold. */
export function maxApproachingDeadlineDate(now: Date, hoursThreshold: number): Date {
	return utcDateOnly(new Date(now.getTime() + hoursThreshold * 3_600_000 - 1));
}

export function timeRemainingHours(deadline: Date, now: Date = new Date()): number {
	return Math.floor((deadline.getTime() - now.getTime()) / 3_600_000);
}

export function formatDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date {
	return new Date(`${value}T00:00:00.000Z`);
}
