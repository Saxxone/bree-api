import { Injectable } from '@nestjs/common';
import { CreateHealthDto } from './dto/create-health.dto';

@Injectable()
export class HealthService {
  create(createHealthDto: CreateHealthDto) {
    return `This action adds a new health ${createHealthDto}}`;
  }

  findAll() {
    return `This action returns all health`;
  }

  findOne(id: number) {
    return `This action returns a #${id} health`;
  }

  update(id: number) {
    return `This action updates a #${id} health`;
  }

  remove(id: number) {
    return `This action removes a #${id} health`;
  }
}
