import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();

    if (request.is('multipart/form-data')) {
      if (!request.files) return next.handle();
      this.logger.log(
        `Incoming Multipart Request - ${request.method} ${request.url} ${request.file}`,
      );
      for (const file of Object.values(
        request.files as { [fieldname: string]: Express.Multer.File[] },
      )[0]) {
        this.logger.log(
          `File: ${file?.originalname}, Size: ${file.size} bytes`,
        );
      }
    } else
      this.logger.log(`Incoming Request - ${request.method} ${request.url} `);

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `Outgoing Response - ${request.method} ${request.url} - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
