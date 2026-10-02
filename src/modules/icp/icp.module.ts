import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IcpProfile } from './entities/icp-profile.entity';
import { IcpService } from './icp.service';
import { IcpWorkflow } from './icp.workflow';
import { SignalsModule } from '../signals/signals.module';
import { LlmModule } from '../llm/llm.module';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IcpProfile]),
    SignalsModule,
    LlmModule,
    IdentityModule,
    AuditModule,
  ],
  providers: [IcpService, IcpWorkflow],
  exports: [IcpService],
})
export class IcpModule {}
