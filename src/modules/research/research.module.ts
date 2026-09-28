import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResearchSource } from './entities/research-source.entity';
import { ResearchService } from './research.service';
import { WebPageConnector } from './connectors/web-page.connector';
import { HackerNewsConnector } from './connectors/hacker-news.connector';
import { GitHubReleasesConnector } from './connectors/github-releases.connector';
import { EvidenceModule } from '../evidence/evidence.module';
import { FetchModule } from '../fetch/fetch.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResearchSource]),
    EvidenceModule,
    FetchModule,
    IdentityModule,
  ],
  providers: [
    ResearchService,
    WebPageConnector,
    HackerNewsConnector,
    GitHubReleasesConnector,
  ],
  exports: [ResearchService],
})
export class ResearchModule {}
