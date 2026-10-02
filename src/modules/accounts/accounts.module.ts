import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountAssessment } from './entities/account-assessment.entity';
import { AccountService } from './account.service';
import { AccountAssessmentWorkflow } from './account.workflow';
import { IcpModule } from '../icp/icp.module';
import { LlmModule } from '../llm/llm.module';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, AccountAssessment]),
    IcpModule,
    LlmModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [AccountService, AccountAssessmentWorkflow],
  exports: [AccountService],
})
export class AccountsModule {}
