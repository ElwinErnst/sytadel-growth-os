import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfig } from './config/configuration';
import { dataSourceOptions } from './database/data-source';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { SignalsModule } from './modules/signals/signals.module';
import { BriefsModule } from './modules/briefs/briefs.module';
import { RunsModule } from './modules/runs/runs.module';
import { FetchModule } from './modules/fetch/fetch.module';
import { ResearchModule } from './modules/research/research.module';
import { GrowthCli } from './cli/growth-cli.service';

/**
 * Root module. There is intentionally no HTTP server in this slice — the app is
 * driven only through the CLI (NestFactory.createApplicationContext), so no data
 * endpoints exist before full authentication is in place.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<AppConfig['db']>('db');
        return {
          ...dataSourceOptions,
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.pass,
          database: db.name,
        };
      },
    }),
    WorkspacesModule,
    EvidenceModule,
    SignalsModule,
    BriefsModule,
    RunsModule,
    FetchModule,
    ResearchModule,
  ],
  providers: [GrowthCli],
})
export class AppModule {}
