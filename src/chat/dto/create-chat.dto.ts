import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBase64,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Per-device Olm ciphertext upper bound. Olm messages for a normal text DM
 *  are small; we leave headroom for media-index messages without allowing a
 *  single socket event to bloat the DB.
 */
export const CHAT_ENVELOPE_CIPHERTEXT_MAX = 32 * 1024;
/** Hard cap on fanout size per message (participants × devices). */
export const CHAT_ENVELOPES_MAX = 64;

export class CreateChatEnvelopeDto {
  @IsUUID()
  recipientUserId!: string;

  @IsUUID()
  recipientDeviceId!: string;

  // Olm emits unpadded standard base64; disable validator.js's default
  // padding requirement so a valid 43/87/... char ciphertext isn't rejected
  // with a generic 400 before the gateway ever sees it.
  @IsBase64({ padding: false })
  @IsString()
  @MaxLength(CHAT_ENVELOPE_CIPHERTEXT_MAX)
  ciphertext!: string;

  /** Olm message type. 0 = PreKeyMessage (bootstrap), 1 = Message (ratchet). */
  @IsIn([0, 1])
  messageType!: 0 | 1;
}

export class CreateChatDto {
  @IsUUID()
  roomId!: string;

  /** Device that authored the message. Gateway enforces this belongs to the
   *  authenticated user. */
  @IsUUID()
  senderDeviceId!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateChatEnvelopeDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(CHAT_ENVELOPES_MAX)
  envelopes!: CreateChatEnvelopeDto[];
}
