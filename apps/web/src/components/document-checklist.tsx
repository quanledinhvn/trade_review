import { cn } from '@/lib/utils';
import type { DocumentType } from '../types';

interface DocumentChecklistProps {
	requiredDocuments: DocumentType[];
	completedDocuments: DocumentType[];
}

function formatDocumentLabel(documentType: DocumentType): string {
	return documentType.replace(/_/g, ' ');
}

export function DocumentChecklist({
	requiredDocuments,
	completedDocuments,
}: DocumentChecklistProps) {
	return (
		<div className="flex flex-wrap gap-2">
			{requiredDocuments.map((documentType) => {
				const isComplete = completedDocuments.includes(documentType);

				return (
					<span
						key={documentType}
						className={cn(
							'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
							isComplete
								? 'border-green-200 bg-green-50 text-green-800'
								: 'bg-muted/50 text-foreground',
						)}
					>
						{isComplete ? '✓' : '○'} {formatDocumentLabel(documentType)}
					</span>
				);
			})}
		</div>
	);
}
