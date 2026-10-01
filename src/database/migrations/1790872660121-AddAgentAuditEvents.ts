import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentAuditEvents1790872660121 implements MigrationInterface {
    name = 'AddAgentAuditEvents1790872660121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "agent_audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "run_id" uuid, "actor_executor_id" text, "actor_sytadel_subject" text, "actor_tenant_id" uuid, "action" text NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1ef823fa74ae7f62d30efa89f1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_audit_workspace" ON "agent_audit_events" ("workspace_id") `);
        await queryRunner.query(`CREATE INDEX "ix_audit_run" ON "agent_audit_events" ("run_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ix_audit_run"`);
        await queryRunner.query(`DROP INDEX "public"."ix_audit_workspace"`);
        await queryRunner.query(`DROP TABLE "agent_audit_events"`);
    }

}
