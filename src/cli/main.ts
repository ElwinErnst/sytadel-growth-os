import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { GrowthCli } from './growth-cli.service';

/**
 * CLI entrypoint. Boots a headless Nest application context (no HTTP server),
 * runs one command, then exits with the command's status code.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  let code = 0;
  try {
    const cli = app.get(GrowthCli);
    code = await cli.run(process.argv.slice(2));
  } catch (err) {
    new Logger('main').error(
      err instanceof Error ? err.message : 'Fatal error',
    );
    code = 1;
  } finally {
    await app.close();
  }
  process.exit(code);
}

void bootstrap();
