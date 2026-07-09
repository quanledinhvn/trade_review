import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { createReviewCase } from '../api/review-cases.api';
import type { CreateReviewCaseRequest, DocumentType, PackagingType } from '../types';

const DEFAULT_REQUIRED_DOCUMENTS: CreateReviewCaseRequest['required_documents'] = [
	'commercial_invoice',
	'packing_list',
	'transport_document',
];

const PACKAGING_TYPE_OPTIONS: PackagingType[] = [
	'wooden_pallet',
	'wooden_crate',
	'natural_wood_box',
	'wooden_bundle',
	'wooden_box_ordinary',
	'reconstituted_wood_box',
	'fibreboard_box',
	'plastic_box',
	'cardboard_crate',
	'pallet_generic',
];

const DOCUMENT_TYPE_OPTIONS: DocumentType[] = [
	'commercial_invoice',
	'packing_list',
	'transport_document',
	'ispm15_certificate',
	'certificate_of_origin',
];

function formatEnumLabel(value: string): string {
	return value.replace(/_/g, ' ');
}

export interface AddReviewCaseFormValues {
	case_reference: string;
	shipment_reference: string;
	importer: string;
	arrival_date: string;
	review_window_days: number;
	assigned_team: string;
	assigned_user: string;
	invoice_value: number;
	packaging_type: PackagingType;
	ispm15_certified: boolean;
	required_documents: DocumentType[];
	completed_documents: DocumentType[];
}

interface AddReviewCaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultAssignedTeam: string;
	onCreated: (caseReference: string) => void;
}

function buildDefaultFormValues(assignedTeam: string): AddReviewCaseFormValues {
	return {
		case_reference: '',
		shipment_reference: '',
		importer: '',
		arrival_date: '2026-07-05',
		review_window_days: 7,
		assigned_team: assignedTeam,
		assigned_user: '',
		invoice_value: 85000,
		packaging_type: 'pallet_generic',
		ispm15_certified: true,
		required_documents: [...DEFAULT_REQUIRED_DOCUMENTS],
		completed_documents: [],
	};
}

function toCreateRequest(form: AddReviewCaseFormValues): CreateReviewCaseRequest {
	const assignedUser = form.assigned_user.trim();

	return {
		case_reference: form.case_reference.trim(),
		shipment_reference: form.shipment_reference.trim(),
		importer: form.importer.trim(),
		arrival_date: form.arrival_date,
		review_window_days: form.review_window_days,
		assigned_team: form.assigned_team.trim(),
		...(assignedUser ? { assigned_user: assignedUser } : {}),
		invoice_value: form.invoice_value,
		packaging_type: form.packaging_type,
		ispm15_certified: form.ispm15_certified,
		required_documents: [...form.required_documents],
		completed_documents: [...form.completed_documents],
	};
}

function toggleDocumentList(
	documents: DocumentType[],
	documentType: DocumentType,
	checked: boolean,
): DocumentType[] {
	if (checked) {
		return documents.includes(documentType) ? documents : [...documents, documentType];
	}

	return documents.filter((document) => document !== documentType);
}

export function AddReviewCaseDialog({
	open,
	onOpenChange,
	defaultAssignedTeam,
	onCreated,
}: AddReviewCaseDialogProps) {
	const [form, setForm] = useState<AddReviewCaseFormValues>(() =>
		buildDefaultFormValues(defaultAssignedTeam),
	);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setForm(buildDefaultFormValues(defaultAssignedTeam));

			setError(null);
		}

		onOpenChange(nextOpen);
	};

	const updateField = <K extends keyof AddReviewCaseFormValues>(
		key: K,
		value: AddReviewCaseFormValues[K],
	) => {
		setForm((current) => ({ ...current, [key]: value }));
	};

	const toggleRequiredDocument = (documentType: DocumentType, checked: boolean) => {
		setForm((current) => {
			const required_documents = toggleDocumentList(
				current.required_documents,
				documentType,
				checked,
			);
			const completed_documents = current.completed_documents.filter((document) =>
				required_documents.includes(document),
			);

			return { ...current, required_documents, completed_documents };
		});
	};

	const toggleCompletedDocument = (documentType: DocumentType, checked: boolean) => {
		setForm((current) => ({
			...current,
			completed_documents: toggleDocumentList(current.completed_documents, documentType, checked),
		}));
	};

	const handleSubmit = async () => {
		const request = toCreateRequest(form);

		if (
			!request.case_reference ||
			!request.shipment_reference ||
			!request.importer ||
			!request.arrival_date ||
			!request.assigned_team ||
			request.review_window_days <= 0 ||
			request.required_documents.length === 0
		) {
			setError('Please fill in all required fields and select at least one required document.');

			return;
		}

		if (
			!request.completed_documents.every((document) =>
				request.required_documents.includes(document),
			)
		) {
			setError('Completed documents must be a subset of required documents.');

			return;
		}

		setIsSubmitting(true);

		setError(null);

		try {
			const created = await createReviewCase(request);

			handleOpenChange(false);

			onCreated(created.case_reference);
		} catch {
			setError('Failed to create review case. Check that the case reference is unique.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-xl gap-0 overflow-hidden p-0">
				<DialogHeader className="border-b px-6 py-4">
					<DialogTitle>Add review case</DialogTitle>
					<DialogDescription>Creates case without running rules</DialogDescription>
				</DialogHeader>

				<div className="max-h-[calc(90vh-8.5rem)] space-y-4 overflow-y-auto px-6 py-4 text-sm">
					<div className="grid grid-cols-2 gap-3">
						<div className="col-span-2 sm:col-span-1">
							<Label htmlFor="case-reference">Case reference</Label>
							<Input
								id="case-reference"
								className="mt-1.5"
								placeholder="REV-2026-0121"
								value={form.case_reference}
								onChange={(event) => updateField('case_reference', event.target.value)}
							/>
						</div>
						<div className="col-span-2 sm:col-span-1">
							<Label htmlFor="shipment-reference">Shipment reference</Label>
							<Input
								id="shipment-reference"
								className="mt-1.5"
								placeholder="SAF-TIME-2026-0121"
								value={form.shipment_reference}
								onChange={(event) => updateField('shipment_reference', event.target.value)}
							/>
						</div>
					</div>

					<div>
						<Label htmlFor="importer">Importer</Label>
						<Input
							id="importer"
							className="mt-1.5"
							placeholder="Eastland Retail Group"
							value={form.importer}
							onChange={(event) => updateField('importer', event.target.value)}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="arrival-date">Arrival date</Label>
							<Input
								id="arrival-date"
								type="date"
								className="mt-1.5"
								value={form.arrival_date}
								onChange={(event) => updateField('arrival_date', event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="review-window">Review window (days)</Label>
							<Input
								id="review-window"
								type="number"
								min={1}
								className="mt-1.5"
								value={form.review_window_days}
								onChange={(event) => updateField('review_window_days', Number(event.target.value))}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="assigned-team">Assigned team</Label>
							<Input
								id="assigned-team"
								className="mt-1.5"
								value={form.assigned_team}
								onChange={(event) => updateField('assigned_team', event.target.value)}
							/>
						</div>
						<div>
							<Label htmlFor="assigned-user">Assigned user (optional)</Label>
							<Input
								id="assigned-user"
								className="mt-1.5"
								placeholder="analyst@example.com"
								value={form.assigned_user}
								onChange={(event) => updateField('assigned_user', event.target.value)}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="invoice-value">Invoice value (USD)</Label>
							<Input
								id="invoice-value"
								type="number"
								min={0}
								className="mt-1.5"
								value={form.invoice_value}
								onChange={(event) => updateField('invoice_value', Number(event.target.value))}
							/>
						</div>
						<div>
							<Label htmlFor="packaging-type">Packaging type</Label>
							<Select
								value={form.packaging_type}
								onValueChange={(value) => updateField('packaging_type', value as PackagingType)}
							>
								<SelectTrigger id="packaging-type" className="mt-1.5">
									<SelectValue placeholder="Select packaging" />
								</SelectTrigger>
								<SelectContent>
									{PACKAGING_TYPE_OPTIONS.map((packagingType) => (
										<SelectItem key={packagingType} value={packagingType}>
											{formatEnumLabel(packagingType)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<input
							id="ispm15-certified"
							type="checkbox"
							checked={form.ispm15_certified}
							onChange={(event) => updateField('ispm15_certified', event.target.checked)}
							className="h-4 w-4 rounded border border-input"
						/>
						<Label htmlFor="ispm15-certified" className="font-normal">
							ISPM-15 certified
						</Label>
					</div>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Required documents</legend>
						<div className="grid gap-2 sm:grid-cols-2">
							{DOCUMENT_TYPE_OPTIONS.map((documentType) => (
								<label key={documentType} className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={form.required_documents.includes(documentType)}
										onChange={(event) => toggleRequiredDocument(documentType, event.target.checked)}
										className="h-4 w-4 rounded border border-input"
									/>
									<span>{formatEnumLabel(documentType)}</span>
								</label>
							))}
						</div>
					</fieldset>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Completed documents</legend>
						{form.required_documents.length === 0 ? (
							<p className="text-muted-foreground">Select required documents first.</p>
						) : (
							<div className="grid gap-2 sm:grid-cols-2">
								{form.required_documents.map((documentType) => (
									<label key={documentType} className="flex items-center gap-2">
										<input
											type="checkbox"
											checked={form.completed_documents.includes(documentType)}
											onChange={(event) =>
												toggleCompletedDocument(documentType, event.target.checked)
											}
											className="h-4 w-4 rounded border border-input"
										/>
										<span>{formatEnumLabel(documentType)}</span>
									</label>
								))}
							</div>
						)}
					</fieldset>

					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>

				<DialogFooter className="border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
						Cancel
					</Button>
					<Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
						{isSubmitting ? 'Creating…' : 'Create case'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
