import axios from 'axios';
import { useSessionStore } from '../stores/session.store';

// Empty VITE_API_URL uses same-origin /api (Vite proxy in dev, nginx in Docker).
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
	baseURL: `${API_BASE}/api`,
	headers: {
		'Content-Type': 'application/json',
	},
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
	const method = config.method?.toLowerCase();

	if (method && MUTATING_METHODS.has(method)) {
		const { user, team } = useSessionStore.getState();

		config.headers.set('X-Actor-Id', user);

		config.headers.set('X-Actor-Team', team);
	}

	return config;
});

api.interceptors.response.use(
	(response) => response.data,
	(error) => Promise.reject(error),
);
