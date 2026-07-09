import { PACKAGING_TYPE, type PackagingType } from './types';

export const PACKAGING_TYPE_VALUES = Object.values(PACKAGING_TYPE) as PackagingType[];

export function isPackagingType(value: string): value is PackagingType {
	return (PACKAGING_TYPE_VALUES as string[]).includes(value);
}
