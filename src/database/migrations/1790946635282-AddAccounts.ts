import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccounts1790946635282 implements MigrationInterface {
    name = 'AddAccounts1790946635282'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "name" text NOT NULL, "name_key" text NOT NULL, "domain" text, "notes" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_accounts_workspace_name" UNIQUE ("workspace_id", "name_key"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_accounts_workspace" ON "accounts" ("workspace_id") `);
        await queryRunner.query(`CREATE TABLE "account_assessments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "account_id" uuid NOT NULL, "icp_version" integer NOT NULL, "fit_score" real NOT NULL, "tier" text NOT NULL, "matched_segments" jsonb NOT NULL DEFAULT '[]', "rationale" text NOT NULL, "gaps" jsonb NOT NULL DEFAULT '[]', "recommended_next_step" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2ee4b2067831e712b279d4828e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_assessments_workspace" ON "account_assessments" ("workspace_id") `);
        await queryRunner.query(`CREATE INDEX "ix_assessments_account" ON "account_assessments" ("account_id") `);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_212b65ba4b65c8c6d2619f3681b" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_assessments" ADD CONSTRAINT "FK_68435df5aad4e78e89807506c49" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_assessments" DROP CONSTRAINT "FK_68435df5aad4e78e89807506c49"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_212b65ba4b65c8c6d2619f3681b"`);
        await queryRunner.query(`DROP INDEX "public"."ix_assessments_account"`);
        await queryRunner.query(`DROP INDEX "public"."ix_assessments_workspace"`);
        await queryRunner.query(`DROP TABLE "account_assessments"`);
        await queryRunner.query(`DROP INDEX "public"."ix_accounts_workspace"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
    }

}
