import { create } from 'zustand';

interface SessionState {
	team: string;
	user: string;
	setTeam: (team: string) => void;
	setUser: (user: string) => void;
}

interface WorkQueueFilterState {
	assignedTeam: string;
	assignedUser: string;
	setAssignedTeam: (team: string) => void;
	setAssignedUser: (user: string) => void;
	applySession: (session: Pick<SessionState, 'team' | 'user'>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
	team: 'trade_operations',
	user: 'ryan',
	setTeam: (team) => set({ team }),
	setUser: (user) => set({ user }),
}));

export const useWorkQueueFilterStore = create<WorkQueueFilterState>((set) => ({
	assignedTeam: 'trade_operations',
	assignedUser: '',
	setAssignedTeam: (assignedTeam) => set({ assignedTeam }),
	setAssignedUser: (assignedUser) => set({ assignedUser }),
	applySession: ({ team, user }) => set({ assignedTeam: team, assignedUser: user }),
}));

interface TradeReviewRefreshState {
	refreshKey: number;
	notifyTradeReviewMutated: () => void;
}

export const useTradeReviewRefreshStore = create<TradeReviewRefreshState>((set) => ({
	refreshKey: 0,
	notifyTradeReviewMutated: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));
