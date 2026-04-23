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

  /** Avoid logging `?token=` and other query secrets in `request.url`. */
  private safeRequestPath(req: { originalUrl?: string; url?: string }): string {
    const raw = (req.originalUrl ?? req.url) || '';
    const q = raw.indexOf('?');
    if (q < 0) {
      return raw;
    }
    const path = raw.slice(0, q);
    const sp = new URLSearchParams(raw.slice(q + 1));
    sp.delete('token');
    const rest = sp.toString();
    return rest ? `${path}?${rest}` : path;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();
    const path = this.safeRequestPath(request);

    if (request.is('multipart/form-data')) {
      if (!request.files) return next.handle();
      this.logger.log(
        `Incoming Multipart Request - ${request.method} ${path} ${request.file}`,
      );
      for (const file of Object.values(
        request.files as { [fieldname: string]: Express.Multer.File[] },
      )[0]) {
        this.logger.log(
          `File: ${file?.originalname}, Size: ${file.size} bytes`,
        );
      }
    } else {
      this.logger.log(`Incoming Request - ${request.method} ${path} `);
    }

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `Outgoing Response - ${request.method} ${path} - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
