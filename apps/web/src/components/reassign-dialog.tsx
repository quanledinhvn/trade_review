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
import { reassignTask } from '../api/task-detail.api';
import type { ReassignRequest } from '../types';

export type ReassignContext = {
	type: 'task';
	caseRef: string;
	taskId: string;
	taskTitle: string;
	assignedTeam: string;
	assignedUser?: string;
};

interface ReassignDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	context: ReassignContext | null;
	onReassigned: () => void;
}

interface ReassignFormValues {
	assignedTeam: string;
	assignedUser: string;
}

function buildFormValues(context: ReassignContext): ReassignFormValues {
	return {
		assignedTeam: context.assignedTeam,
		assignedUser: context.assignedUser ?? '',
	};
}

function toRequest(form: ReassignFormValues): ReassignRequest | null {
	const assignedTeam = form.assignedTeam.trim();

	if (!assignedTeam) {
		return null;
	}

	const assignedUser = form.assignedUser.trim();

	return {
		assigned_team: assignedTeam,
		...(assignedUser ? { assigned_user: assignedUser } : {}),
	};
}

function getReassignDialogKey(context: ReassignContext): string {
	return `task-${context.caseRef}-${context.taskId}`;
}

export function ReassignDialog({
	open,
	onOpenChange,
	context,
	onReassigned,
}: ReassignDialogProps) {
	const [form, setForm] = useState<ReassignFormValues>({ assignedTeam: '', assignedUser: '' });
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [prevDialogKey, setPrevDialogKey] = useState<string | null>(null);

	const dialogKey = open && context ? getReassignDialogKey(context) : null;

	if (dialogKey !== prevDialogKey) {
		setPrevDialogKey(dialogKey);

		if (dialogKey && context) {
			setForm(buildFormValues(context));

			setError(null);
		}
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setError(null);
		}

		onOpenChange(nextOpen);
	};

	const handleSubmit = async () => {
		if (!context) {
			return;
		}

		const request = toRequest(form);

		if (!request) {
			setError('Assigned team is required.');

			return;
		}

		setIsSubmitting(true);

		setError(null);

		try {
			await reassignTask(context.taskId, request);

			handleOpenChange(false);

			onReassigned();
		} catch {
			setError('Failed to reassign. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const subtitle = context ? `${context.caseRef} / ${context.taskTitle}` : undefined;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-md gap-0 p-0">
				<DialogHeader className="border-b px-6 py-4">
					<DialogTitle>Reassign task</DialogTitle>
					{subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
				</DialogHeader>

				<form
					className="space-y-4 px-6 py-4 text-sm"
					onSubmit={(event) => {
						event.preventDefault();

						void handleSubmit();
					}}
				>
					<div>
						<Label htmlFor="reassign-team">
							Assigned team <span className="text-destructive">*</span>
						</Label>
						<Input
							id="reassign-team"
							className="mt-1.5"
							placeholder="trade_operations"
							value={form.assignedTeam}
							onChange={(event) =>
								setForm((current) => ({ ...current, assignedTeam: event.target.value }))
							}
							required
							disabled={isSubmitting}
						/>
					</div>

					<div>
						<Label htmlFor="reassign-user">
							Assigned user <span className="font-normal text-muted-foreground">(optional)</span>
						</Label>
						<Input
							id="reassign-user"
							className="mt-1.5"
							placeholder="ryan"
							value={form.assignedUser}
							onChange={(event) =>
								setForm((current) => ({ ...current, assignedUser: event.target.value }))
							}
							disabled={isSubmitting}
						/>
					</div>

					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</form>

				<DialogFooter className="border-t px-6 py-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
						{isSubmitting ? 'Saving…' : 'Save'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
