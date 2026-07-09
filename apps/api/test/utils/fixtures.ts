import { DOCUMENT_TYPE } from '../../src/domain/document-type';
import { PACKAGING_TYPE } from '../../src/domain/packaging';

export const validCreatePayload = {
	case_reference: 'REV-2026-TEST-001',
	shipment_reference: 'SAF-TIME-2026-TEST-001',
	importer: 'Eastland Retail Group',
	arrival_date: '2026-07-01',
	review_window_days: 7,
	invoice_value: 125000,
	packaging_type: PACKAGING_TYPE.WOODEN_CRATE,
	ispm15_certified: false,
	required_documents: [
		DOCUMENT_TYPE.COMMERCIAL_INVOICE,
		DOCUMENT_TYPE.PACKING_LIST,
		DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
	],
	completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
	assigned_team: 'trade_operations',
};

/** Canonical REV-2026-0119 input — missing transport doc, wood uncertified, high value. */
export const canonicalCasePayload = {
	required_documents: [
		DOCUMENT_TYPE.COMMERCIAL_INVOICE,
		DOCUMENT_TYPE.PACKING_LIST,
		DOCUMENT_TYPE.TRANSPORT_DOCUMENT,
	],
	completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
	packaging_type: PACKAGING_TYPE.WOODEN_CRATE,
	ispm15_certified: false,
	invoice_value: 125000,
};

/** Clean case — no missing docs, no wood/high-value triggers. */
export const cleanCasePayload = {
	required_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
	completed_documents: [DOCUMENT_TYPE.COMMERCIAL_INVOICE],
	packaging_type: PACKAGING_TYPE.PLASTIC_BOX,
	ispm15_certified: true,
	invoice_value: 500,
};
