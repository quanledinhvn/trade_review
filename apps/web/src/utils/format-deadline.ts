export function formatTimeRemaining(hours: number): string {
	if (hours < 0) {
		return 'Overdue';
	}

	return `${hours}h left`;
}

export function formatDeadlineRemaining(hours: number): string {
	if (hours < 0) {
		return 'overdue';
	}

	return `${hours}h remaining`;
}
