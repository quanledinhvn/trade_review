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
import { createReviewCase } from '../api/review-cases.api';
import type { CreateReviewCaseRequest } from '../types';

const DEFAULT_REQUIRED_DOCUMENTS: CreateReviewCaseRequest['required_documents'] = [
	'commercial_invoice',
	'packing_list',
	'transport_document',
];

export interface AddReviewCaseFormValues {
	case_reference: string;
	shipment_reference: string;
	importer: string;
	arrival_date: string;
	review_window_days: number;
	assigned_team: string;
	invoice_value: number;
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
		invoice_value: 85000,
	};
}

function toCreateRequest(form: AddReviewCaseFormValues): CreateReviewCaseRequest {
	return {
		case_reference: form.case_reference.trim(),
		shipment_reference: form.shipment_reference.trim(),
		importer: form.importer.trim(),
		arrival_date: form.arrival_date,
		review_window_days: form.review_window_days,
		assigned_team: form.assigned_team.trim(),
		invoice_value: form.invoice_value,
		packaging_type: 'pallet_generic',
		ispm15_certified: true,
		required_documents: DEFAULT_REQUIRED_DOCUMENTS,
		completed_documents: [],
	};
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

	const handleSubmit = async () => {
		const request = toCreateRequest(form);

		if (
			!request.case_reference ||
			!request.shipment_reference ||
			!request.importer ||
			!request.arrival_date ||
			!request.assigned_team ||
			request.review_window_days <= 0
		) {
			setError('Please fill in all required fields.');

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
			<DialogContent className="max-w-lg gap-0 p-0">
				<DialogHeader className="border-b px-6 py-4">
					<DialogTitle>Add review case</DialogTitle>
					<DialogDescription>Creates case without running rules</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 px-6 py-4 text-sm">
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
					</div>

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
