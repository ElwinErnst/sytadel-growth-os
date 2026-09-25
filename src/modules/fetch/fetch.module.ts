import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { EvidenceModule } from '../evidence/evidence.module';
import { HttpFetcher } from './http-fetcher';
import { FetchService } from './fetch.service';

/**
 * Wires the hardened fetcher from config. `allowLoopback` is always false here —
 * only tests construct a loopback-allowing fetcher, and only against a local
 * server.
 */
@Module({
  imports: [EvidenceModule],
  providers: [
    {
      provide: HttpFetcher,
      inject: [ConfigService],
      useFactory: (config: ConfigService): HttpFetcher => {
        const f = config.getOrThrow<AppConfig['fetch']>('fetch');
        return new HttpFetcher({
          maxRedirects: f.maxRedirects,
          maxBytes: f.maxBytes,
          timeoutMs: f.timeoutMs,
          allowLoopback: false,
        });
      },
    },
    FetchService,
  ],
  exports: [FetchService, HttpFetcher],
})
export class FetchModule {}
