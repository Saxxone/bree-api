import { IsUUID } from 'class-validator';

export class StripeCheckoutDto {
  @IsUUID('4')
  packageId!: string;
}
