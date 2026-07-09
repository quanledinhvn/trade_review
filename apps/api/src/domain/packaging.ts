import { PACKAGING_TYPE, type PackagingType } from './types';

export interface PackagingMeta {
	rec21Code: string;
	name: string;
	requiresIspm15: boolean;
}

export const PACKAGING: Record<PackagingType, PackagingMeta> = {
	[PACKAGING_TYPE.WOODEN_PALLET]: {
		rec21Code: '8A',
		name: 'Pallet, wooden',
		requiresIspm15: true,
	},
	[PACKAGING_TYPE.WOODEN_CRATE]: {
		rec21Code: '8B',
		name: 'Crate, wooden',
		requiresIspm15: true,
	},
	[PACKAGING_TYPE.NATURAL_WOOD_BOX]: {
		rec21Code: '4C',
		name: 'Box, natural wood',
		requiresIspm15: true,
	},
	[PACKAGING_TYPE.WOODEN_BUNDLE]: {
		rec21Code: '8C',
		name: 'Bundle, wooden',
		requiresIspm15: true,
	},
	[PACKAGING_TYPE.WOODEN_BOX_ORDINARY]: {
		rec21Code: 'QP',
		name: 'Box, wooden, natural wood, ordinary',
		requiresIspm15: true,
	},
	[PACKAGING_TYPE.RECONSTITUTED_WOOD_BOX]: {
		rec21Code: '4D',
		name: 'Box, reconstituted wood',
		requiresIspm15: false,
	},
	[PACKAGING_TYPE.FIBREBOARD_BOX]: {
		rec21Code: '4G',
		name: 'Box, fibreboard',
		requiresIspm15: false,
	},
	[PACKAGING_TYPE.PLASTIC_BOX]: {
		rec21Code: '4H',
		name: 'Box, plastic',
		requiresIspm15: false,
	},
	[PACKAGING_TYPE.CARDBOARD_CRATE]: {
		rec21Code: 'DC',
		name: 'Crate, multiple layer, cardboard',
		requiresIspm15: false,
	},
	[PACKAGING_TYPE.PALLET_GENERIC]: {
		rec21Code: 'PX',
		name: 'Pallet',
		requiresIspm15: false,
	},
};

export function isWoodPackaging(packagingType?: PackagingType): boolean {
	return packagingType !== undefined && PACKAGING[packagingType].requiresIspm15;
}
