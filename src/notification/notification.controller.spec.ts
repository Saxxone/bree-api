import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ExpoPushService } from './expo-push.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: {} },
        { provide: EventEmitter2, useValue: { on: jest.fn(), off: jest.fn() } },
        { provide: ExpoPushService, useValue: {} },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
