import axios from 'axios';
import { api } from '@/lib/api';
import { fetchCaseTasks } from './case-detail.api';
import type {
	CompleteTaskRequest,
	CompleteTaskResponse,
	ReassignRequest,
	ReassignTaskResponse,
	TaskDto,
} from '../types';

export async function fetchTask(caseRef: string, taskId: string): Promise<TaskDto> {
	const tasks = await fetchCaseTasks(caseRef);
	const task = tasks.find((item) => item.id === taskId);

	if (!task) {
		throw new Error('Task not found');
	}

	return task;
}

export async function completeTask(
	taskId: string,
	payload: CompleteTaskRequest,
): Promise<CompleteTaskResponse> {
	try {
		return (await api.post(`/tasks/${encodeURIComponent(taskId)}/complete`, payload)) as CompleteTaskResponse;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 409) {
			throw new TaskAlreadyCompletedError();
		}

		throw error;
	}
}

export class TaskAlreadyCompletedError extends Error {
	constructor() {
		super('Task is already completed');

		this.name = 'TaskAlreadyCompletedError';
	}
}

export function reassignTask(
	taskId: string,
	payload: ReassignRequest,
): Promise<ReassignTaskResponse> {
	return api.post(`/tasks/${encodeURIComponent(taskId)}/reassign`, payload) as Promise<ReassignTaskResponse>;
}
