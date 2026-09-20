import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceEvidence } from './entities/source-evidence.entity';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [TypeOrmModule.forFeature([SourceEvidence])],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
