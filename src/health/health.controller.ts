import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from 'src/auth/auth.guard';
import { api_base_url, ui_base_url } from 'utils';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly db: PrismaHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  url = api_base_url;
  ui_url = ui_base_url;

  @Public()
  @Get('api')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.http.pingCheck('bree-api', this.url + '/hello'),
    ]);
  }

  @Public()
  @Get('ui')
  @HealthCheck()
  checkFrontend() {
    return this.health.check([
      () =>
        this.http.responseCheck(
          'bree-web',
          this.ui_url + '/login',
          (res) => res.status === 200,
        ),
    ]);
  }

  @Public()
  @Get('db')
  @HealthCheck()
  databaseCheck() {
    return this.health.check([
      () => this.http.pingCheck('bree-db', 'database'),
    ]);
  }

  @Public()
  @Get('storage')
  @HealthCheck()
  storageCheck() {
    return this.health.check([
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.5 }),
    ]);
  }

  @Public()
  @Get('memory')
  @HealthCheck()
  memoryCheck() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}
