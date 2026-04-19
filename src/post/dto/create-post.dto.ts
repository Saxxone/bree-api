import { PostType, VideoCategory, ProductionTier } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
  Allow,
  IsOptional,
} from 'class-validator';

export class LongPostBlockDto {
  @IsString()
  text: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  media: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaTypes?: string[];
}

export class LongPostDto {
  @ValidateNested({ each: true })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => LongPostBlockDto)
  content: LongPostBlockDto[];
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @Allow()
  @IsArray()
  @IsString({ each: true })
  media?: string[];

  @IsOptional()
  @Allow()
  @IsArray()
  @IsString({ each: true })
  mediaTypes?: string[];

  @IsOptional()
  @Allow()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Allow()
  @ValidateNested()
  @Type(() => LongPostDto)
  longPost?: LongPostDto;

  @IsOptional()
  @Allow()
  @IsString()
  type?: PostType;

  @IsOptional()
  @Allow()
  monetizationEnabled?: boolean;

  /** Ignored for pricing: duration comes from ffprobe on uploaded video files. */
  @IsOptional()
  @Allow()
  videoDurationSeconds?: number;

  @IsOptional()
  @Allow()
  videoCategory?: VideoCategory;

  @IsOptional()
  @Allow()
  productionTier?: ProductionTier;

  @IsOptional()
  @Allow()
  baseRateMinorPerMinute?: number;
}
