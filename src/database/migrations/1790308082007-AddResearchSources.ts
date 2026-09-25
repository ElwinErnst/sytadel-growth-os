import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResearchSources1790308082007 implements MigrationInterface {
    name = 'AddResearchSources1790308082007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "research_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "kind" text NOT NULL DEFAULT 'web_page', "url" text NOT NULL, "label" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_research_source_workspace_url" UNIQUE ("workspace_id", "url"), CONSTRAINT "PK_9b9f569796c4c007d9aee38737a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_research_sources_workspace" ON "research_sources" ("workspace_id") `);
        await queryRunner.query(`ALTER TABLE "research_sources" ADD CONSTRAINT "FK_3a101b129bb883b541343d075e0" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "research_sources" DROP CONSTRAINT "FK_3a101b129bb883b541343d075e0"`);
        await queryRunner.query(`DROP INDEX "public"."ix_research_sources_workspace"`);
        await queryRunner.query(`DROP TABLE "research_sources"`);
    }

}
