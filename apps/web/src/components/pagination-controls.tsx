import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PaginationState {
	page: number;
	totalPages: number;
	total: number;
	start: number;
	end: number;
	limit: number;
}

interface PaginationControlsProps {
	pagination: PaginationState;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
	limitOptions?: number[];
	className?: string;
}

function buildPageList(page: number, totalPages: number): Array<number | '…'> {
	const pages: Array<number | '…'> = [];

	for (let current = 1; current <= totalPages; current += 1) {
		if (
			totalPages <= 7 ||
			current === 1 ||
			current === totalPages ||
			Math.abs(current - page) <= 1
		) {
			pages.push(current);
		} else if (pages[pages.length - 1] !== '…') {
			pages.push('…');
		}
	}

	return pages;
}

export function PaginationControls({
	pagination,
	onPageChange,
	onLimitChange,
	limitOptions = [2, 5, 20],
	className,
}: PaginationControlsProps) {
	const { page, totalPages, total, limit } = pagination;

	if (!total) {
		return null;
	}

	const pages = buildPageList(page, totalPages);

	return (
		<div className={cn('flex flex-wrap items-center gap-2', className)}>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-w-8 px-2"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					‹
				</Button>
				{pages.map((pageNumber, index) => {
					const previousPage = pages[index - 1];
					const nextPage = pages[index + 1];

					return pageNumber === '…' ? (
						<span
							key={`ellipsis-${String(previousPage)}-${String(nextPage)}`}
							className="px-1 text-muted-foreground"
						>
							…
						</span>
					) : (
						<Button
							key={pageNumber}
							type="button"
							variant={pageNumber === page ? 'default' : 'outline'}
							size="sm"
							className="h-8 min-w-8 px-2"
							onClick={() => onPageChange(pageNumber)}
						>
							{pageNumber}
						</Button>
					);
				})}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 min-w-8 px-2"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					›
				</Button>
			</div>
			<label className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>Limit</span>
				<Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
					<SelectTrigger className="h-8 w-16 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{limitOptions.map((option) => (
							<SelectItem key={option} value={String(option)}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</label>
		</div>
	);
}

export function toPaginationState(total: number, page: number, limit: number): PaginationState {
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const safePage = Math.min(Math.max(1, page), totalPages);
	const start = total ? (safePage - 1) * limit + 1 : 0;
	const end = Math.min(safePage * limit, total);

	return {
		page: safePage,
		totalPages,
		total,
		start,
		end,
		limit,
	};
}
