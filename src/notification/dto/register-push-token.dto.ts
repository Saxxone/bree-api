import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const PLATFORMS = ['ios', 'android', 'unknown'] as const;

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsString()
  @IsIn([...PLATFORMS])
  platform?: (typeof PLATFORMS)[number];
}

export class RemovePushTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
