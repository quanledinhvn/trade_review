import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { completeTask, fetchTask, TaskAlreadyCompletedError } from '../api/task-detail.api';
import { ReassignDialog, type ReassignContext } from '../components/reassign-dialog';
import { SeverityBadge } from '../components/severity-badge';
import { StatusBadge } from '../components/status-badge';
import { useTradeReviewRefreshStore } from '../stores/session.store';
import type { TaskDto } from '../types';

function formatDocumentLabel(documentType: string): string {
	return documentType.replace(/_/g, ' ');
}

export function TaskDetailPage() {
	const { caseRef, taskId } = useParams({ from: '/_app/cases/$caseRef/tasks/$taskId' });
	const navigate = useNavigate();
	const notifyTradeReviewMutated = useTradeReviewRefreshStore(
		(state) => state.notifyTradeReviewMutated,
	);

	const [task, setTask] = useState<TaskDto | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [resolutionComment, setResolutionComment] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [reassignOpen, setReassignOpen] = useState(false);
	const [reassignContext, setReassignContext] = useState<ReassignContext | null>(null);
	const [trackedTaskKey, setTrackedTaskKey] = useState(`${caseRef}:${taskId}`);

	const taskKey = `${caseRef}:${taskId}`;

	if (trackedTaskKey !== taskKey) {
		setTrackedTaskKey(taskKey);

		setIsLoading(true);

		setLoadError(null);
	}

	useEffect(() => {
		let cancelled = false;

		fetchTask(caseRef, taskId)
			.then((response) => {
				if (!cancelled) {
					setTask(response);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLoadError('Failed to load task detail.');

					setTask(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [caseRef, taskId]);

	const handleBack = () => {
		void navigate({ to: '/cases/$caseRef', params: { caseRef } });
	};

	const handleComplete = async () => {
		setIsSubmitting(true);

		setSubmitError(null);

		try {
			await completeTask(taskId, {
				resolution_comment: resolutionComment.trim() || undefined,
			});

			notifyTradeReviewMutated();

			void navigate({ to: '/cases/$caseRef', params: { caseRef } });
		} catch (error) {
			if (error instanceof TaskAlreadyCompletedError) {
				setSubmitError('This task has already been completed.');
			} else {
				setSubmitError('Failed to complete task. Please try again.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenReassign = () => {
		if (!task) {
			return;
		}

		setReassignContext({
			type: 'task',
			caseRef,
			taskId: task.id,
			taskTitle: task.title,
			assignedTeam: task.assigned_team,
			assignedUser: task.assigned_user,
		});

		setReassignOpen(true);
	};

	const handleReassigned = () => {
		void fetchTask(caseRef, taskId)
			.then((response) => setTask(response))
			.catch(() => setLoadError('Failed to load task detail.'));
	};

	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading task detail…</p>;
	}

	if (loadError || !task) {
		return (
			<div>
				<nav className="mb-4">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-auto px-0 text-muted-foreground hover:text-foreground"
						onClick={handleBack}
					>
						<ChevronLeft />
						Back
					</Button>
				</nav>
				<p className="text-sm text-destructive">{loadError ?? 'Task not found.'}</p>
			</div>
		);
	}

	return (
		<div>
			<nav className="mb-4">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-auto px-0 text-muted-foreground hover:text-foreground"
					onClick={handleBack}
				>
					<ChevronLeft />
					Back
				</Button>
			</nav>

			<div className="mb-4">
				<button
					type="button"
					onClick={handleBack}
					className="mb-2 text-xs text-muted-foreground hover:text-foreground"
				>
					{caseRef}
				</button>
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
					<SeverityBadge severity={task.severity} />
					<StatusBadge status={task.status} />
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<div className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-6 py-4">
							<h3 className="font-semibold">Description</h3>
						</div>
						<p className="px-6 py-4 text-sm leading-relaxed">{task.description}</p>
					</div>

					<div className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-6 py-4">
							<h3 className="font-semibold">Suggested action</h3>
						</div>
						<p className="px-6 py-4 text-sm">{task.suggested_action}</p>
					</div>

					<div className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-6 py-4">
							<h3 className="font-semibold">Complete task</h3>
						</div>
						<div className="space-y-3 px-6 py-4">
							<Textarea
								rows={3}
								placeholder="Resolution comment (optional)"
								value={resolutionComment}
								onChange={(event) => setResolutionComment(event.target.value)}
								disabled={isSubmitting}
							/>
							{submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
							<Button type="button" onClick={() => void handleComplete()} disabled={isSubmitting}>
								{isSubmitting ? 'Completing…' : 'Mark complete'}
							</Button>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					<div className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-4 py-3">
							<h3 className="text-sm font-semibold">Details</h3>
						</div>
						<dl className="space-y-3 px-4 py-3 text-sm">
							<div>
								<dt className="text-xs text-muted-foreground">Rule</dt>
								<dd className="mt-0.5 font-mono text-xs">{task.rule_id ?? '—'}</dd>
							</div>
							<div>
								<dt className="text-xs text-muted-foreground">Due date</dt>
								<dd className="mt-0.5 font-medium">{task.due_date}</dd>
							</div>
							<div>
								<dt className="text-xs text-muted-foreground">Assigned team</dt>
								<dd className="mt-0.5 font-medium">{task.assigned_team}</dd>
							</div>
							<div>
								<dt className="text-xs text-muted-foreground">Assigned user</dt>
								<dd className="mt-0.5 font-medium">{task.assigned_user ?? '—'}</dd>
							</div>
							{task.document_type ? (
								<div>
									<dt className="text-xs text-muted-foreground">Document type</dt>
									<dd className="mt-0.5 font-medium capitalize">
										{formatDocumentLabel(task.document_type)}
									</dd>
								</div>
							) : null}
						</dl>
					</div>

					<div className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-4 py-3">
							<h3 className="text-sm font-semibold">Actions</h3>
						</div>
						<div className="space-y-2 p-4">
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={handleOpenReassign}
							>
								Reassign
							</Button>
						</div>
					</div>
				</div>
			</div>

			<ReassignDialog
				open={reassignOpen}
				onOpenChange={setReassignOpen}
				context={reassignContext}
				onReassigned={handleReassigned}
			/>
		</div>
	);
}
