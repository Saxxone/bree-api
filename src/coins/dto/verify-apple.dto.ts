import { IsString, MinLength } from 'class-validator';

export class VerifyAppleDto {
  @IsString()
  @MinLength(8)
  transactionId!: string;
}
