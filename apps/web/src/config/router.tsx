import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { RootLayout } from '../layouts/root-layout';
import { AppLayout } from '@/layouts/app-layout';
import { AuditLogPage } from '@/pages/audit-log-page';
import { CaseDetailPage } from '@/pages/case-detail-page';
import { ReviewCasesPage } from '@/pages/review-cases-page';
import { TaskDetailPage } from '@/pages/task-detail-page';
import { WorkQueuePage } from '@/pages/work-queue-page';

const rootRoute = createRootRoute({
	component: RootLayout,
});

const appRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: '_app',
	component: AppLayout,
});

const indexRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/',
	beforeLoad: () => {
		throw redirect({ to: '/work-queue' });
	},
});

const workQueueRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/work-queue',
	component: WorkQueuePage,
});

const reviewCasesRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/review-cases',
	component: ReviewCasesPage,
});

const caseDetailRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/cases/$caseRef',
	component: CaseDetailPage,
	validateSearch: (search: Record<string, unknown>): { from?: 'work-queue' | 'review-cases' } => {
		const from = search.from;

		if (from === 'review-cases' || from === 'work-queue') {
			return { from };
		}

		return {};
	},
});

const taskDetailRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/cases/$caseRef/tasks/$taskId',
	component: TaskDetailPage,
});

const auditLogRoute = createRoute({
	getParentRoute: () => appRoute,
	path: '/cases/$caseRef/audit-log',
	component: AuditLogPage,
	validateSearch: (search: Record<string, unknown>): { from?: 'work-queue' | 'review-cases' } => {
		const from = search.from;

		if (from === 'review-cases' || from === 'work-queue') {
			return { from };
		}

		return {};
	},
});

const routeTree = rootRoute.addChildren([
	appRoute.addChildren([
		indexRoute,
		workQueueRoute,
		reviewCasesRoute,
		caseDetailRoute,
		taskDetailRoute,
		auditLogRoute,
	]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
