import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { WorkQueueQuery } from '../types';

interface WorkQueueFiltersProps {
	assignedTeam: string;
	assignedUser: string;
	deadline: NonNullable<WorkQueueQuery['deadline']>;
	sort: NonNullable<WorkQueueQuery['sort']>;
	onAssignedTeamChange: (value: string) => void;
	onAssignedUserChange: (value: string) => void;
	onDeadlineChange: (value: NonNullable<WorkQueueQuery['deadline']>) => void;
	onSortChange: (value: NonNullable<WorkQueueQuery['sort']>) => void;
}

export function WorkQueueFilters({
	assignedTeam,
	assignedUser,
	deadline,
	sort,
	onAssignedTeamChange,
	onAssignedUserChange,
	onDeadlineChange,
	onSortChange,
}: WorkQueueFiltersProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<label className="sr-only" htmlFor="wq-filter-team">
				Assigned team
			</label>
			<Input
				id="wq-filter-team"
				value={assignedTeam}
				onChange={(event) => onAssignedTeamChange(event.target.value)}
				placeholder="assigned_team"
				className="h-9 w-36"
			/>
			<label className="sr-only" htmlFor="wq-filter-user">
				Assigned user
			</label>
			<Input
				id="wq-filter-user"
				value={assignedUser}
				onChange={(event) => onAssignedUserChange(event.target.value)}
				placeholder="assigned_user (optional)"
				className="h-9 w-40"
			/>
			<Select value={deadline} onValueChange={onDeadlineChange}>
				<SelectTrigger className="h-9 w-[180px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Deadline: All</SelectItem>
					<SelectItem value="approaching">Approaching (&lt;48h)</SelectItem>
					<SelectItem value="past">Past deadline</SelectItem>
				</SelectContent>
			</Select>
			<Select value={sort} onValueChange={onSortChange}>
				<SelectTrigger className="h-9 w-[140px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="risk">Sort: Risk</SelectItem>
					<SelectItem value="deadline">Sort: Deadline</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
