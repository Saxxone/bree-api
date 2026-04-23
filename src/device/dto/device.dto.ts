import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBase64,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Size bounds for device-key material. Curve25519/Ed25519 public keys are
 * 32 raw bytes → 43/44 base64 chars; signatures are 64 bytes → 88 chars.
 * We keep slightly larger upper bounds to allow padding variants but reject
 * anything that could not possibly be a valid Olm key string.
 *
 * Olm emits *unpadded* standard base64 (e.g. 43-char public keys), so every
 * `@IsBase64` on Olm material must disable the default padding requirement —
 * otherwise validator.js rejects the value before the controller runs and
 * the client sees a generic 400.
 */
export const OLM_PUBLIC_KEY_MAX = 64;
export const OLM_SIGNATURE_MAX = 128;
export const OLM_KEY_ID_MAX = 64;
export const DEVICE_LABEL_MAX = 96;

const OLM_BASE64 = { padding: false } as const;

export class OlmSignedKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(OLM_KEY_ID_MAX)
  keyId!: string;

  @IsBase64(OLM_BASE64)
  @MaxLength(OLM_PUBLIC_KEY_MAX)
  publicKey!: string;

  @IsBase64(OLM_BASE64)
  @MaxLength(OLM_SIGNATURE_MAX)
  signature!: string;
}

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DEVICE_LABEL_MAX)
  label!: string;

  /** Curve25519 device identity key (base64 raw, 32B, unpadded). */
  @IsBase64(OLM_BASE64)
  @MaxLength(OLM_PUBLIC_KEY_MAX)
  identityKeyCurve25519!: string;

  /** Ed25519 device identity key (base64 raw, 32B, unpadded). */
  @IsBase64(OLM_BASE64)
  @MaxLength(OLM_PUBLIC_KEY_MAX)
  identityKeyEd25519!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OlmSignedKeyDto)
  oneTimeKeys!: OlmSignedKeyDto[];

  @ValidateNested()
  @Type(() => OlmSignedKeyDto)
  fallbackKey!: OlmSignedKeyDto;
}

export class UploadOneTimeKeysDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OlmSignedKeyDto)
  oneTimeKeys!: OlmSignedKeyDto[];

  /** Optional: rotate the fallback key in the same request. */
  @IsOptional()
  @ValidateNested()
  @Type(() => OlmSignedKeyDto)
  fallbackKey?: OlmSignedKeyDto;
}

export class ClaimKeysDto {
  @IsUUID()
  targetUserId!: string;
}
