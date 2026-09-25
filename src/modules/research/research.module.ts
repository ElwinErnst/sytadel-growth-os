import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResearchSource } from './entities/research-source.entity';
import { ResearchService } from './research.service';
import { WebPageConnector } from './connectors/web-page.connector';
import { EvidenceModule } from '../evidence/evidence.module';
import { FetchModule } from '../fetch/fetch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResearchSource]),
    EvidenceModule,
    FetchModule,
  ],
  providers: [ResearchService, WebPageConnector],
  exports: [ResearchService],
})
export class ResearchModule {}
