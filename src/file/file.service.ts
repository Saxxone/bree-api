import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateFileDto } from './dto/update-file.dto';
import { UserService } from 'src/user/user.service';
import { PrismaService } from '../prisma.service';
import { Prisma, Status } from '@prisma/client';


@Injectable()
export class FileService {
  constructor(
    private userService: UserService,
    private prisma: PrismaService
  ) {}
  

  async create(files: Array<Express.Multer.File>, email: string): Promise<string[]> {
    const user = await this.userService.findUser(email);
    const savedFiles: string[] = [];

    for (const file of files) {
      const savedFile = await this.prisma.file.create({
        data: {
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          url: file.path,
          mimetype: file.mimetype,
          size: file.size,
          status: Status.PENDING,
          type: file.mimetype.split('/')[0],
          owner: {
            connect: { id: user.id }, 
          },
        } as Prisma.FileCreateInput
      });
      savedFiles.push(savedFile.id);
    }

    return savedFiles
  }

  async getFilesUrls(fileIds: string[] | Prisma.PostCreatemediaInput[]): Promise<{url: string, type: string}[]> {
    return await Promise.all(fileIds.map(async (fileId) => {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
  
      if (!file) {
        throw new NotFoundException('File not found');
      }
  
      return {url: file.url, type: file.type};
    }));

  
  }


  async markFileAsUploaded(fileIds: string[]) {
    return Promise.all(fileIds.map(async (fileId) => {
      const file = await this.prisma.file.update({
        where: { id: fileId },
        data: { status: Status.UPLOADED },
      });
  
      if (!file) {
        throw new NotFoundException('File not found');
      }
  
      return file.status;
    }));
  }
  


  findAll() {
    return `This action returns all file`;
  }

  findOne(id: number) {
    return `This action returns a #${id} file`;
  }

  update(id: number, updateFileDto: UpdateFileDto) {
    return `This action updates a #${id} file`;
  }

  remove(id: number) {
    return `This action removes a #${id} file`;
  }
}
