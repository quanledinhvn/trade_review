/**
 * Returns fields from `source` for every key defined on `keys`.
 * `keys` declares the field set; values are read from `source`.
 *
 * @example
 * pickFieldsFrom({ id: 1, name: 'a', extra: true }, { id: 0, name: '' })
 * // => { id: 1, name: 'a' }
 */
export function pickFieldsFrom<TKeys extends object, TSource extends object>(
	source: TSource,
	keys: TKeys,
): Pick<TSource, Extract<keyof TSource, keyof TKeys>> {
	const result = {} as Record<string, unknown>;
	const sourceRecord = source as Record<string, unknown>;

	for (const key of Object.keys(keys)) {
		if (key in sourceRecord) {
			result[key] = sourceRecord[key];
		}
	}

	return result as Pick<TSource, Extract<keyof TSource, keyof TKeys>>;
}
