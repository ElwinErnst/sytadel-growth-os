import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRunEvidencePosition1789959823174 implements MigrationInterface {
    name = 'AddRunEvidencePosition1789959823174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "run_evidence" ADD "position" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "run_evidence" DROP COLUMN "position"`);
    }

}
