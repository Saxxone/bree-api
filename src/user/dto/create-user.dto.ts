import {
  Allow,
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @Allow()
  bio?: string;

  @Allow()
  @IsString()
  img?: string;

  @Allow()
  @IsString()
  banner?: string;
}

export class CreateFedUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @Allow()
  bio?: string;

  @Allow()
  @IsString()
  img: string;

  @Allow()
  @IsString()
  banner?: string;

  publicKey?: string;
}
