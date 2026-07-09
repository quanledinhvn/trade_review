import { DOCUMENT_TYPE, type DocumentType } from './types';

export const DOCUMENT_TYPE_VALUES = Object.values(DOCUMENT_TYPE) as DocumentType[];

export function isDocumentType(value: string): value is DocumentType {
	return (DOCUMENT_TYPE_VALUES as string[]).includes(value);
}
