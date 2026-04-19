import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { FileService } from '../src/file/file.service';
import { TrailerBackfillCliModule } from './trailer-backfill-cli.module';

const logger = new Logger('TrailerBackfillCli');

async function main() {
  const app = await NestFactory.createApplicationContext(
    TrailerBackfillCliModule,
    {
      logger: ['error', 'warn', 'log'],
    },
  );
  try {
    const fileService = app.get(FileService);
    const { candidateCount } = await fileService.runTrailerBackfillJob();
    logger.log(`Done. Batch size processed: ${candidateCount}.`);
    if (candidateCount > 0) {
      logger.log(
        'Re-run the script to process more rows, or adjust TRAILER_BACKFILL_BATCH.',
      );
    }
    if (process.env.TRAILER_BACKFILL_OVERRIDE?.trim()) {
      logger.warn(
        'TRAILER_BACKFILL_OVERRIDE is set — trailers were allowed to replace existing ones. Unset it when finished.',
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  logger.error(err);
  process.exitCode = 1;
});
