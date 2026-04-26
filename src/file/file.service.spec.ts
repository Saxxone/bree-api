import { ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { Status, File as FileModel } from '@prisma/client';
import { FileService } from './file.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';

function fileStub(
  partial: Pick<FileModel, 'status' | 'ownerId'> & Partial<FileModel>,
): FileModel {
  return partial as FileModel;
}

describe('FileService', () => {
  let service: FileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: UserService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: R2StorageService, useValue: {} },
        {
          provide: getQueueToken('video-transcode'),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertStreamAccess', () => {
    it('allows anonymous access when file is UPLOADED', () => {
      expect(() =>
        service.assertStreamAccess(
          fileStub({ status: Status.UPLOADED, ownerId: 'any' }),
          undefined,
        ),
      ).not.toThrow();
    });

    it('forbids anonymous access when file is not UPLOADED', () => {
      expect(() =>
        service.assertStreamAccess(
          fileStub({ status: Status.PENDING, ownerId: 'owner-1' }),
          undefined,
        ),
      ).toThrow(ForbiddenException);
    });

    it('allows owner when file is PENDING', () => {
      expect(() =>
        service.assertStreamAccess(
          fileStub({ status: Status.PENDING, ownerId: 'owner-1' }),
          { userId: 'owner-1' },
        ),
      ).not.toThrow();
    });

    it('forbids non-owner when file is PENDING', () => {
      expect(() =>
        service.assertStreamAccess(
          fileStub({ status: Status.PENDING, ownerId: 'owner-1' }),
          { userId: 'other' },
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
