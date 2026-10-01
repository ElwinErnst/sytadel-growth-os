import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentAuditEvent } from './entities/agent-audit-event.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentAuditEvent])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
