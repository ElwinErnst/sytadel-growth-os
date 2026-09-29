import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { SytadelIdentityService } from './sytadel-identity.service';
import {
  SECRET_NAMES,
  SECRET_PROVIDER,
  SecretProvider,
} from '../secrets/secret-provider';

/**
 * Provides the Sytadel identity client, built from the resolved `sytadel` config
 * plus the client secret sourced from the SecretProvider (never from config).
 * Constructed with a plain config so it is trivially testable against a fixture
 * auth server.
 */
@Module({
  providers: [
    {
      provide: SytadelIdentityService,
      inject: [ConfigService, SECRET_PROVIDER],
      useFactory: (
        config: ConfigService,
        secrets: SecretProvider,
      ): SytadelIdentityService =>
        new SytadelIdentityService({
          ...config.getOrThrow<AppConfig['sytadel']>('sytadel'),
          clientSecret: secrets.get(SECRET_NAMES.SYTADEL_CLIENT_SECRET),
        }),
    },
  ],
  exports: [SytadelIdentityService],
})
export class IdentityModule {}
