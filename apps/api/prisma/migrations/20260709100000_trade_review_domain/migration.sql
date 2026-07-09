-- CreateTable
CREATE TABLE "review_cases" (
    "id" TEXT NOT NULL,
    "case_reference" TEXT NOT NULL,
    "shipment_reference" TEXT NOT NULL,
    "importer" TEXT NOT NULL,
    "arrival_date" DATE NOT NULL,
    "review_window_days" INTEGER NOT NULL,
    "deadline" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "risk_rank" INTEGER NOT NULL,
    "assigned_team" TEXT NOT NULL,
    "assigned_user" TEXT,
    "required_documents" TEXT[],
    "completed_documents" TEXT[],
    "invoice_value" DECIMAL(15,2) NOT NULL,
    "packaging_type" TEXT,
    "ispm15_certified" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "severity_rank" INTEGER NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "assigned_team" TEXT NOT NULL,
    "assigned_user" TEXT,
    "status" TEXT NOT NULL,
    "resolution_comment" TEXT,
    "document_type" TEXT,
    "rule_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_reason" TEXT,
    "rule_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_cases_case_reference_key" ON "review_cases"("case_reference");

-- CreateIndex
CREATE INDEX "review_cases_risk_rank_deadline_idx" ON "review_cases"("risk_rank" DESC, "deadline" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_case_id_rule_id_key" ON "tasks"("case_id", "rule_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active escalation per type per case (resolve-then-insert invariant)
CREATE UNIQUE INDEX "escalations_one_active_per_type" ON "escalations"("case_id", "type") WHERE "status" = 'active';
