import {
	calculateDeadline,
	maxApproachingDeadlineDate,
	maxPastDeadlineDate,
	minApproachingDeadlineDate,
	timeRemainingHours,
	utcDateOnly,
} from './deadline';

describe('deadline', () => {
	it('calculateDeadline adds calendar days to arrival date', () => {
		const arrival = new Date('2026-07-01T00:00:00.000Z');
		const deadline = calculateDeadline(arrival, 7);

		expect(deadline.toISOString().slice(0, 10)).toBe('2026-07-08');
	});

	it('timeRemainingHours returns hours until deadline', () => {
		const deadline = new Date('2026-07-08T12:00:00.000Z');
		const now = new Date('2026-07-07T00:00:00.000Z');

		expect(timeRemainingHours(deadline, now)).toBe(36);
	});

	it('timeRemainingHours is negative when deadline has passed', () => {
		const deadline = new Date('2026-07-01T00:00:00.000Z');
		const now = new Date('2026-07-02T12:00:00.000Z');

		expect(timeRemainingHours(deadline, now)).toBe(-36);
	});

	describe('deadline date bounds for @db.Date filters', () => {
		const now = new Date('2026-07-09T14:00:00.000Z');

		it('maxPastDeadlineDate matches timeRemainingHours < 0', () => {
			const maxPast = maxPastDeadlineDate(now);

			for (const day of ['2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']) {
				const deadline = utcDateOnly(new Date(`${day}T00:00:00.000Z`));
				const included = deadline.getTime() <= maxPast.getTime();
				const isPast = timeRemainingHours(deadline, now) < 0;

				expect(included).toBe(isPast);
			}
		});

		it('approaching bounds match 0 <= timeRemainingHours < 48', () => {
			const min = minApproachingDeadlineDate(now);
			const max = maxApproachingDeadlineDate(now, 48);

			for (const day of ['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13']) {
				const deadline = utcDateOnly(new Date(`${day}T00:00:00.000Z`));
				const included = deadline.getTime() >= min.getTime() && deadline.getTime() <= max.getTime();
				const hoursLeft = timeRemainingHours(deadline, now);
				const isApproaching = hoursLeft >= 0 && hoursLeft < 48;

				expect(included).toBe(isApproaching);
			}
		});
	});
});
