import { AppBadRequestException, AppNotAllowedException } from '../common/exceptions/exception';
import { assertActorOnAssignedTeam, parseActorContext } from './actor';

describe('parseActorContext', () => {
	it('throws 400 when actorId is missing', () => {
		expect(() => parseActorContext(undefined, 'trade_operations')).toThrow(AppBadRequestException);
	});

	it('throws 400 when actorTeam is missing', () => {
		expect(() => parseActorContext('bob', undefined)).toThrow(AppBadRequestException);
	});

	it('returns trimmed actor context when both headers are present', () => {
		expect(parseActorContext(' bob ', ' trade_operations ')).toEqual({
			actorId: 'bob',
			actorTeam: 'trade_operations',
		});
	});
});

describe('assertActorOnAssignedTeam', () => {
	const actor = { actorId: 'bob', actorTeam: 'trade_operations' };

	it('passes when actorTeam matches and no assignedUser', () => {
		expect(() => assertActorOnAssignedTeam(actor, 'trade_operations')).not.toThrow();
	});

	it('throws 403 when actorTeam does not match assignedTeam', () => {
		expect(() => assertActorOnAssignedTeam(actor, 'customs_brokerage')).toThrow(
			AppNotAllowedException,
		);
	});

	it('throws 403 when assignedUser is set and actorId differs', () => {
		expect(() => assertActorOnAssignedTeam(actor, 'trade_operations', 'minh')).toThrow(
			AppNotAllowedException,
		);
	});

	it('passes when assignedUser is set and actorId matches', () => {
		expect(() =>
			assertActorOnAssignedTeam(
				{ actorId: 'minh', actorTeam: 'trade_operations' },
				'trade_operations',
				'minh',
			),
		).not.toThrow();
	});
});
