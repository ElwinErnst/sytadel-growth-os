import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSytadelIdentity1790541763554 implements MigrationInterface {
    name = 'AddSytadelIdentity1790541763554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent_runs" ADD "sytadel_subject" text`);
        await queryRunner.query(`ALTER TABLE "agent_runs" ADD "sytadel_tenant_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agent_runs" DROP COLUMN "sytadel_tenant_id"`);
        await queryRunner.query(`ALTER TABLE "agent_runs" DROP COLUMN "sytadel_subject"`);
    }

}
