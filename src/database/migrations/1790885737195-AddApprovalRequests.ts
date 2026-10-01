import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApprovalRequests1790885737195 implements MigrationInterface {
    name = 'AddApprovalRequests1790885737195'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "approval_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "status" text NOT NULL DEFAULT 'pending', "action" text NOT NULL, "params" jsonb NOT NULL DEFAULT '{}', "requested_by" text NOT NULL, "decided_by" text, "decided_at" TIMESTAMP WITH TIME ZONE, "executed_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_484806bb8ff331b851fc75973c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_approvals_workspace" ON "approval_requests" ("workspace_id") `);
        await queryRunner.query(`CREATE INDEX "ix_approvals_status" ON "approval_requests" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ix_approvals_status"`);
        await queryRunner.query(`DROP INDEX "public"."ix_approvals_workspace"`);
        await queryRunner.query(`DROP TABLE "approval_requests"`);
    }

}
