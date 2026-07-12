import { pickFieldsFrom } from './pick-fields-from';

describe('pickFieldsFrom', () => {
	it('reads source values for keys declared on keys', () => {
		const keys = { id: 0, name: '', active: false };
		const source = { id: 1, name: 'alpha', active: true, extra: 'ignored' };

		expect(pickFieldsFrom(source, keys)).toEqual({ id: 1, name: 'alpha', active: true });
	});

	it('omits keys missing on source', () => {
		const keys = { id: 0, missing: '' };
		const source = { id: 2 };

		expect(pickFieldsFrom(source, keys)).toEqual({ id: 2 });
	});

	it('returns an empty object when no keys overlap', () => {
		expect(pickFieldsFrom({ b: 2 }, { a: 1 })).toEqual({});
	});
});
