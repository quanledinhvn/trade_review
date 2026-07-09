import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ClipboardList, LayoutGrid, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSessionStore, useWorkQueueFilterStore } from '@/stores/session.store';

const navItems = [
	{ to: '/work-queue', label: 'Work queue', icon: LayoutGrid },
	{ to: '/review-cases', label: 'Review cases', icon: ClipboardList },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
	const team = useSessionStore((state) => state.team);
	const user = useSessionStore((state) => state.user);
	const setTeam = useSessionStore((state) => state.setTeam);
	const setUser = useSessionStore((state) => state.setUser);
	const applySession = useWorkQueueFilterStore((state) => state.applySession);
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	const handleApplySession = () => {
		applySession({ team, user });
	};

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
							S
						</div>
						<div>
							<p className="text-sm font-semibold leading-none">Safiri Trade Review</p>
							<p className="mt-0.5 text-xs text-muted-foreground">Operations work queue</p>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-3">
						<div className="hidden items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 sm:flex">
							<Users className="text-muted-foreground" />
							<span className="text-xs text-muted-foreground">Session</span>
						</div>
						<div className="flex items-center gap-2">
							<label className="sr-only" htmlFor="session-team">
								Team
							</label>
							<Input
								id="session-team"
								value={team}
								onChange={(event) => setTeam(event.target.value)}
								placeholder="team"
								className="h-9 w-28 sm:w-36"
							/>
							<label className="sr-only" htmlFor="session-user">
								User
							</label>
							<Input
								id="session-user"
								value={user}
								onChange={(event) => setUser(event.target.value)}
								placeholder="user"
								className="h-9 w-24 sm:w-32"
							/>
						</div>
						<Button type="button" className="h-9" onClick={handleApplySession}>
							Apply
						</Button>
					</div>
				</div>
			</header>

			<div className="border-b bg-muted/30">
				<div className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6">
					{navItems.map(({ to, label, icon: Icon }) => {
						const isActive = pathname === to;

						return (
							<Link
								key={to}
								to={to}
								className={cn(
									'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors',
									isActive
										? 'bg-accent font-medium text-foreground'
										: 'text-muted-foreground hover:bg-accent hover:text-foreground',
								)}
							>
								<Icon />
								{label}
							</Link>
						);
					})}
				</div>
			</div>

			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
		</div>
	);
}
