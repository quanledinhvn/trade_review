export const DOCUMENT_TYPE = {
	COMMERCIAL_INVOICE: 'commercial_invoice',
	PACKING_LIST: 'packing_list',
	TRANSPORT_DOCUMENT: 'transport_document',
	ISPM15_CERTIFICATE: 'ispm15_certificate',
	CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

export const DOCUMENT_TYPE_VALUES = Object.values(DOCUMENT_TYPE) as DocumentType[];

export function isDocumentType(value: string): value is DocumentType {
	return (DOCUMENT_TYPE_VALUES as string[]).includes(value);
}
