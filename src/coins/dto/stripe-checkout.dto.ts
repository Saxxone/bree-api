import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class StripeCheckoutDto {
  @IsUUID('4')
  packageId!: string;

  /** When `native`, success/cancel URLs target the mobile app deep link scheme. */
  @IsOptional()
  @IsIn(['web', 'native'])
  client?: 'web' | 'native';
}
