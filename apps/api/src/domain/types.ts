export const ESCALATION_STATUS = {
	ACTIVE: 'active',
	RESOLVED: 'resolved',
} as const;

export type EscalationStatus = (typeof ESCALATION_STATUS)[keyof typeof ESCALATION_STATUS];

export const ESCALATION_TYPE = {
	DEADLINE: 'deadline',
} as const;

export type EscalationType = (typeof ESCALATION_TYPE)[keyof typeof ESCALATION_TYPE];

export const RESOLVED_REASON = {
	CASE_COMPLETED: 'case_completed',
	SUPERSEDED: 'superseded',
} as const;

export type ResolvedReason = (typeof RESOLVED_REASON)[keyof typeof RESOLVED_REASON];

export const DOCUMENT_TYPE = {
	COMMERCIAL_INVOICE: 'commercial_invoice',
	PACKING_LIST: 'packing_list',
	TRANSPORT_DOCUMENT: 'transport_document',
	ISPM15_CERTIFICATE: 'ispm15_certificate',
	CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

export const PACKAGING_TYPE = {
	WOODEN_PALLET: 'wooden_pallet',
	WOODEN_CRATE: 'wooden_crate',
	NATURAL_WOOD_BOX: 'natural_wood_box',
	WOODEN_BUNDLE: 'wooden_bundle',
	WOODEN_BOX_ORDINARY: 'wooden_box_ordinary',
	RECONSTITUTED_WOOD_BOX: 'reconstituted_wood_box',
	FIBREBOARD_BOX: 'fibreboard_box',
	PLASTIC_BOX: 'plastic_box',
	CARDBOARD_CRATE: 'cardboard_crate',
	PALLET_GENERIC: 'pallet_generic',
} as const;

export type PackagingType = (typeof PACKAGING_TYPE)[keyof typeof PACKAGING_TYPE];

export const AUDIT_ENTITY_TYPE = {
	CASE: 'case',
	TASK: 'task',
	ESCALATION: 'escalation',
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];
