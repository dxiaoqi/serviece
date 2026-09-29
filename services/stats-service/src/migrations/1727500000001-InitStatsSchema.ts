import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitStatsSchema1727500000001 implements MigrationInterface {
  name = 'InitStatsSchema1727500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(
      `CREATE TABLE "download_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "app_key" character varying(64) NOT NULL,
        "platform" character varying(16) NOT NULL DEFAULT 'unknown',
        "version" character varying(32),
        "ip" character varying(64),
        "user_agent" character varying(256),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_38fde111105ca11a6691e6c58dd" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_download_app_key" ON "download_records" ("app_key")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_download_created_at" ON "download_records" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_download_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_download_app_key"`);
    await queryRunner.query(`DROP TABLE "download_records"`);
  }
}
