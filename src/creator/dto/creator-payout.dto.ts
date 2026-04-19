import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreatorPayoutDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coinsMinor!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey!: string;
}
