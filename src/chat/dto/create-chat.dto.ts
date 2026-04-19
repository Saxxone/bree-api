import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  media?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsUUID()
  toUserId: string;

  @IsUUID()
  fromUserId: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  /** Base64 RSA-OAEP ciphertext (wrapped AES key for hybrid, or legacy full message). */
  @IsOptional()
  @IsString()
  senderEncryptedMessage?: string;

  /** Base64 RSA-OAEP ciphertext (wrapped AES key for hybrid, or legacy full message). */
  @IsOptional()
  @IsString()
  receiverEncryptedMessage?: string;

  /** Base64 AES-GCM bundle: iv || ciphertext || tag (hybrid v2). */
  @IsOptional()
  @IsString()
  encryptedPayload?: string;
}
