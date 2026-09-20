import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FounderBrief } from './entities/founder-brief.entity';
import { BriefService } from './brief.service';

@Module({
  imports: [TypeOrmModule.forFeature([FounderBrief])],
  providers: [BriefService],
  exports: [BriefService],
})
export class BriefsModule {}
