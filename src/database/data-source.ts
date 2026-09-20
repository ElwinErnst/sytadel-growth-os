import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadConfig } from '../config/configuration';

/**
 * TypeORM DataSource used by the migration CLI and by the app/CLI at runtime
 * (via a factory that reuses these options). Entities are picked up by glob so
 * every `*.entity.ts` is included and the generated baseline covers the whole
 * schema. `synchronize` is OFF everywhere — schema changes go through explicit
 * migrations only.
 */
const cfg = loadConfig();

export const dataSourceOptions = {
  type: 'postgres' as const,
  host: cfg.db.host,
  port: cfg.db.port,
  username: cfg.db.user,
  password: cfg.db.pass,
  database: cfg.db.name,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  migrationsRun: false,
};

export default new DataSource(dataSourceOptions);
