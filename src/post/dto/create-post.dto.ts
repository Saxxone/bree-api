import {
  PostType,
  LongPostBlock,
  VideoCategory,
  ProductionTier,
} from '@prisma/client';
import {
  IsString,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
  Allow,
} from 'class-validator';

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

  @Allow()
  monetizationEnabled?: boolean;

  /** Ignored for pricing: duration comes from ffprobe on uploaded video files. */
  @Allow()
  videoDurationSeconds?: number;

  @Allow()
  videoCategory?: VideoCategory;

  @Allow()
  productionTier?: ProductionTier;

  @Allow()
  baseRateMinorPerMinute?: number;
}
