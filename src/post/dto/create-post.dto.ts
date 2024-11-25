import { PostType, LongPostBlock } from '@prisma/client'; // Correct import
import {
  IsString,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
  Allow,
} from 'class-validator'; // Add necessary validators
import { Type } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  text: string;

  @Allow()
  @IsString({ each: true })
  media?: string[];

  @Allow()
  @IsString({ each: true })
  mediaTypes?: string[];

  @Allow()
  @IsString()
  parentId?: string;

  @Allow()
  @ValidateNested({ each: true })
  @IsArray()
  @ArrayNotEmpty()
  longPost?: {
    content: LongPostBlock[];
  };

  @Allow()
  @IsString()
  type?: PostType;
}
