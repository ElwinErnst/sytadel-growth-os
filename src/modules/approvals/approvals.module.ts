import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalService } from './approval.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRequest]), AuditModule],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalsModule {}
