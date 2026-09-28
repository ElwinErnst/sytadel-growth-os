import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { SytadelIdentityService } from './sytadel-identity.service';

/**
 * Provides the Sytadel identity client, built from the resolved `sytadel`
 * config. The service is constructed with the config block directly so it is
 * trivially testable against a fixture auth server.
 */
@Module({
  providers: [
    {
      provide: SytadelIdentityService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SytadelIdentityService =>
        new SytadelIdentityService(
          config.getOrThrow<AppConfig['sytadel']>('sytadel'),
        ),
    },
  ],
  exports: [SytadelIdentityService],
})
export class IdentityModule {}
