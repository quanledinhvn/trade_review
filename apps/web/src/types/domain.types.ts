export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type RiskLevel = Severity;

export type CaseStatus = 'open' | 'in_review' | 'completed' | 'cancelled';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type DocumentType =
	| 'commercial_invoice'
	| 'packing_list'
	| 'transport_document'
	| 'ispm15_certificate'
	| 'certificate_of_origin';

export type PackagingType =
	| 'wooden_pallet'
	| 'wooden_crate'
	| 'natural_wood_box'
	| 'wooden_bundle'
	| 'wooden_box_ordinary'
	| 'reconstituted_wood_box'
	| 'fibreboard_box'
	| 'plastic_box'
	| 'cardboard_crate'
	| 'pallet_generic';

export type EscalationStatus = 'active' | 'resolved';

export const SEVERITY_RANK: Record<Severity, number> = {
	critical: 40,
	high: 30,
	medium: 20,
	low: 10,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
	critical: 'Critical',
	high: 'High',
	medium: 'Medium',
	low: 'Low',
};

export interface Paginated<T> {
	total: number;
	items: T[];
}

export interface EscalationDto {
	id?: string;
	rule_id?: string;
	type?: string;
	severity: Severity;
	reason: string;
	suggested_action?: string;
	status?: EscalationStatus;
	resolved_reason?: string | null;
	created_at?: string;
}

export interface TaskDto {
	id: string;
	title: string;
	description: string;
	severity: Severity;
	status: TaskStatus;
	suggested_action: string;
	due_date: string;
	assigned_team: string;
	assigned_user?: string;
	resolution_comment?: string;
	document_type?: DocumentType;
	rule_id?: string;
}

export interface CaseViewDto {
	case_reference: string;
	shipment_reference: string;
	importer: string;
	status: CaseStatus;
	risk_level: RiskLevel;
	deadline: string;
	time_remaining_hours: number;
	open_tasks: Array<Pick<TaskDto, 'id' | 'title' | 'severity' | 'status' | 'suggested_action'>>;
	escalations: Array<Pick<EscalationDto, 'severity' | 'reason' | 'suggested_action'>>;
}

export interface WorkQueueQuery {
	assigned_team?: string;
	assigned_user?: string;
	deadline?: 'all' | 'approaching' | 'past';
	sort?: 'risk' | 'deadline';
	page?: number;
	limit?: number;
}

export type WorkQueueResponse = Paginated<CaseViewDto>;

export type ReviewCasesStatusFilter = 'all' | CaseStatus | 'cancelled';

export interface ReviewCaseListItemDto {
	case_reference: string;
	shipment_reference: string;
	importer: string;
	status: CaseStatus;
	risk_level: RiskLevel;
	deadline: string;
	time_remaining_hours: number;
	escalations: Array<Pick<EscalationDto, 'severity' | 'reason'>>;
	assigned_team: string;
	assigned_user?: string;
}

export interface ReviewCasesQuery {
	status?: ReviewCasesStatusFilter;
	page?: number;
	limit?: number;
}

export type ReviewCasesResponse = Paginated<ReviewCaseListItemDto>;

export interface CreateReviewCaseRequest {
	case_reference: string;
	shipment_reference: string;
	importer: string;
	arrival_date: string;
	review_window_days: number;
	invoice_value: number;
	packaging_type: PackagingType;
	ispm15_certified: boolean;
	required_documents: DocumentType[];
	completed_documents: DocumentType[];
	assigned_team: string;
	assigned_user?: string;
}

export interface ReviewCaseResponse {
	id: string;
	case_reference: string;
	shipment_reference: string;
	importer: string;
	arrival_date: string;
	review_window_days: number;
	deadline: string;
	time_remaining_hours: number;
	status: CaseStatus;
	risk_level: RiskLevel;
	invoice_value: number;
	packaging_type: PackagingType | string;
	ispm15_certified: boolean;
	required_documents: DocumentType[];
	completed_documents: DocumentType[];
	assigned_team: string;
	assigned_user?: string;
	created_at?: string;
	updated_at?: string;
	escalations: EscalationDto[];
	/** @deprecated mock-only — real API uses GET .../tasks */
	open_tasks?: TaskDto[];
}

export type ReviewCaseDetail = ReviewCaseResponse;

export type CaseDetailFrom = 'work-queue' | 'review-cases';

export interface CompleteTaskRequest {
	resolution_comment?: string;
}

export interface CompleteTaskResponse {
	id: string;
	status: 'completed';
	resolution_comment?: string;
	document_completed?: DocumentType;
}

export interface ReassignRequest {
	assigned_team: string;
	assigned_user?: string;
}

export type ReassignTaskResponse = TaskDto;

export type ReassignCaseResponse = Pick<
	ReviewCaseDetail,
	'id' | 'case_reference' | 'assigned_team' | 'assigned_user' | 'updated_at'
>;

export interface AuditLogEntry {
	id: string;
	action: string;
	entity_type?: 'case' | 'task' | 'escalation';
	entity_id?: string;
	summary: string;
	actor: string;
	created_at: string;
	before?: Record<string, unknown>;
	after?: Record<string, unknown>;
}

export interface RunRulesResponse {
	risk_level: RiskLevel;
	tasks: number;
	escalations: number;
}

export interface CancelCaseRequest {
	reason: string;
}

export interface CancelCaseResponse {
	id: string;
	status: 'cancelled';
	cancelled_tasks: number;
}
