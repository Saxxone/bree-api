import { IsString, Allow } from 'class-validator';

export class CreatePostDto {
  @IsString()
  text: string;

  @Allow()
  @IsString({ each: true })
  media?: string[];

  @Allow()
  @IsString()
  parentId?: string;
}
