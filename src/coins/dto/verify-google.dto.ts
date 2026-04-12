import { IsString, MinLength } from 'class-validator';

export class VerifyGoogleDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsString()
  @MinLength(8)
  purchaseToken!: string;
}
