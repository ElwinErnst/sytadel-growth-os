import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIcpProfiles1790914096412 implements MigrationInterface {
    name = 'AddIcpProfiles1790914096412'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "icp_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "version" integer NOT NULL, "title" text NOT NULL, "content" jsonb NOT NULL, "body_markdown" text NOT NULL, "source_signal_count" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_icp_workspace_version" UNIQUE ("workspace_id", "version"), CONSTRAINT "PK_24321cacc93d35e1ba71a2054a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_icp_workspace" ON "icp_profiles" ("workspace_id") `);
        await queryRunner.query(`ALTER TABLE "icp_profiles" ADD CONSTRAINT "FK_e0e3020d65991057cf6d8c67761" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "icp_profiles" DROP CONSTRAINT "FK_e0e3020d65991057cf6d8c67761"`);
        await queryRunner.query(`DROP INDEX "public"."ix_icp_workspace"`);
        await queryRunner.query(`DROP TABLE "icp_profiles"`);
    }

}
