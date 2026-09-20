import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1789903036712 implements MigrationInterface {
    name = 'Init1789903036712'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid_generate_v4() (used for PK defaults) lives in uuid-ossp.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" text NOT NULL, "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_workspaces_slug" ON "workspaces" ("slug") `);
        await queryRunner.query(`CREATE TABLE "agent_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "idempotency_key" text NOT NULL, "executor_id" text NOT NULL, "executor_kind" text NOT NULL DEFAULT 'local', "agent_role" text NOT NULL DEFAULT 'market_research', "workflow_version" text NOT NULL, "prompt_version" text NOT NULL, "provider" text NOT NULL, "model" text NOT NULL, "status" text NOT NULL DEFAULT 'pending', "stage" text NOT NULL DEFAULT 'created', "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_runs_workspace_idempotency" UNIQUE ("workspace_id", "idempotency_key"), CONSTRAINT "PK_442f7e0ec4ae860cf17edc57825" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_runs_workspace" ON "agent_runs" ("workspace_id") `);
        await queryRunner.query(`CREATE INDEX "ix_runs_status" ON "agent_runs" ("status") `);
        await queryRunner.query(`CREATE TABLE "source_evidence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "source_name" text NOT NULL, "source_url" text NOT NULL, "retrieved_at" TIMESTAMP WITH TIME ZONE NOT NULL, "provenance" text NOT NULL DEFAULT 'manual', "content_hash" text NOT NULL, "content" text NOT NULL, "content_bytes" integer NOT NULL, "ingested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_evidence_workspace_hash" UNIQUE ("workspace_id", "content_hash"), CONSTRAINT "PK_32e07e23d5754dba7b5c0d39f79" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_evidence_workspace" ON "source_evidence" ("workspace_id") `);
        await queryRunner.query(`CREATE TABLE "run_evidence" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "evidence_id" uuid NOT NULL, "workspace_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_run_evidence_pair" UNIQUE ("run_id", "evidence_id"), CONSTRAINT "PK_4f0a48ab703515d22efbc3f705b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "market_signals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "run_id" uuid NOT NULL, "evidence_id" uuid NOT NULL, "category" text NOT NULL, "kind" text NOT NULL, "statement" text NOT NULL, "evidence_quote" text, "confidence" real NOT NULL, "fingerprint" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_signal_run_fingerprint" UNIQUE ("run_id", "fingerprint"), CONSTRAINT "PK_9a5c5201f7cd18dfb489db8bda6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_signals_workspace" ON "market_signals" ("workspace_id") `);
        await queryRunner.query(`CREATE INDEX "ix_signals_run" ON "market_signals" ("run_id") `);
        await queryRunner.query(`CREATE TABLE "founder_briefs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "run_id" uuid NOT NULL, "title" text NOT NULL, "body_markdown" text NOT NULL, "content" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_brief_run" UNIQUE ("run_id"), CONSTRAINT "PK_2218ed5f8de67669de8befd6503" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_briefs_workspace" ON "founder_briefs" ("workspace_id") `);
        await queryRunner.query(`ALTER TABLE "agent_runs" ADD CONSTRAINT "FK_b54365ad8960707516ef4f3559c" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_evidence" ADD CONSTRAINT "FK_e30b5466a46c6b551fe24ca0148" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "run_evidence" ADD CONSTRAINT "FK_03e2c57d78aceec032583804282" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "run_evidence" ADD CONSTRAINT "FK_e57c0e83dc47cfb300cbba1f7ad" FOREIGN KEY ("evidence_id") REFERENCES "source_evidence"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_signals" ADD CONSTRAINT "FK_c041735dfb7904c2c2c626ac966" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_signals" ADD CONSTRAINT "FK_dfc7f3432f8cf2fbdd338c2bb65" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "market_signals" ADD CONSTRAINT "FK_403599f09972e4ed05b8c805bc3" FOREIGN KEY ("evidence_id") REFERENCES "source_evidence"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "founder_briefs" ADD CONSTRAINT "FK_3087c77be0d4abb389280f9de5d" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "founder_briefs" ADD CONSTRAINT "FK_e5b63e63a1f4bbb5133494644ab" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "founder_briefs" DROP CONSTRAINT "FK_e5b63e63a1f4bbb5133494644ab"`);
        await queryRunner.query(`ALTER TABLE "founder_briefs" DROP CONSTRAINT "FK_3087c77be0d4abb389280f9de5d"`);
        await queryRunner.query(`ALTER TABLE "market_signals" DROP CONSTRAINT "FK_403599f09972e4ed05b8c805bc3"`);
        await queryRunner.query(`ALTER TABLE "market_signals" DROP CONSTRAINT "FK_dfc7f3432f8cf2fbdd338c2bb65"`);
        await queryRunner.query(`ALTER TABLE "market_signals" DROP CONSTRAINT "FK_c041735dfb7904c2c2c626ac966"`);
        await queryRunner.query(`ALTER TABLE "run_evidence" DROP CONSTRAINT "FK_e57c0e83dc47cfb300cbba1f7ad"`);
        await queryRunner.query(`ALTER TABLE "run_evidence" DROP CONSTRAINT "FK_03e2c57d78aceec032583804282"`);
        await queryRunner.query(`ALTER TABLE "source_evidence" DROP CONSTRAINT "FK_e30b5466a46c6b551fe24ca0148"`);
        await queryRunner.query(`ALTER TABLE "agent_runs" DROP CONSTRAINT "FK_b54365ad8960707516ef4f3559c"`);
        await queryRunner.query(`DROP INDEX "public"."ix_briefs_workspace"`);
        await queryRunner.query(`DROP TABLE "founder_briefs"`);
        await queryRunner.query(`DROP INDEX "public"."ix_signals_run"`);
        await queryRunner.query(`DROP INDEX "public"."ix_signals_workspace"`);
        await queryRunner.query(`DROP TABLE "market_signals"`);
        await queryRunner.query(`DROP TABLE "run_evidence"`);
        await queryRunner.query(`DROP INDEX "public"."ix_evidence_workspace"`);
        await queryRunner.query(`DROP TABLE "source_evidence"`);
        await queryRunner.query(`DROP INDEX "public"."ix_runs_status"`);
        await queryRunner.query(`DROP INDEX "public"."ix_runs_workspace"`);
        await queryRunner.query(`DROP TABLE "agent_runs"`);
        await queryRunner.query(`DROP INDEX "public"."uq_workspaces_slug"`);
        await queryRunner.query(`DROP TABLE "workspaces"`);
    }

}
