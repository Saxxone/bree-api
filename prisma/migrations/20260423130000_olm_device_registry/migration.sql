-- Hard cutover from RSA-OAEP hybrid DMs to per-device Olm (Double Ratchet).
-- Existing DM history is dropped intentionally: the new protocol uses fresh
-- per-device keypairs so old ciphertext is unreadable anyway.

-- 1. Drop legacy chat rows + the per-user RSA ciphertext sidecar.
TRUNCATE TABLE "UserChatEncryptedMessage" CASCADE;
TRUNCATE TABLE "Chat" CASCADE;

-- 2. Drop legacy E2EE columns / tables.
ALTER TABLE "Chat"
  DROP CONSTRAINT IF EXISTS "Chat_toUserId_fkey",
  DROP CONSTRAINT IF EXISTS "Chat_fromUserId_fkey",
  DROP CONSTRAINT IF EXISTS "Chat_deletedByUserId_fkey",
  DROP CONSTRAINT IF EXISTS "Chat_roomId_fkey";

DROP INDEX IF EXISTS "Chat_roomId_createdAt_idx";

ALTER TABLE "Chat"
  DROP COLUMN IF EXISTS "encryptedPayload",
  DROP COLUMN IF EXISTS "text",
  DROP COLUMN IF EXISTS "media",
  DROP COLUMN IF EXISTS "mediaType",
  DROP COLUMN IF EXISTS "read",
  DROP COLUMN IF EXISTS "deletedByUserId",
  DROP COLUMN IF EXISTS "deletedByMe",
  DROP COLUMN IF EXISTS "updatedAt",
  DROP COLUMN IF EXISTS "toUserId",
  DROP COLUMN IF EXISTS "fromUserId",
  DROP COLUMN IF EXISTS "status";

DROP TABLE IF EXISTS "UserChatEncryptedMessage";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "publicKey",
  DROP COLUMN IF EXISTS "e2eePrivateKeyBackupCiphertext",
  DROP COLUMN IF EXISTS "e2eePrivateKeyBackupMeta";

-- 3. New Chat schema: per-device sender, envelopes hold ciphertext.
ALTER TABLE "Chat"
  ADD COLUMN "senderUserId"   TEXT NOT NULL,
  ADD COLUMN "senderDeviceId" TEXT NOT NULL;

-- `roomId` becomes mandatory on the new schema.
UPDATE "Chat" SET "roomId" = NULL WHERE FALSE; -- no-op safety for DO blocks
ALTER TABLE "Chat"
  ALTER COLUMN "roomId" SET NOT NULL;

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Device + prekey tables.
CREATE TABLE "Device" (
  "id"                    TEXT         NOT NULL,
  "userId"                TEXT         NOT NULL,
  "label"                 TEXT         NOT NULL,
  "identityKeyCurve25519" TEXT         NOT NULL,
  "identityKeyEd25519"    TEXT         NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "lastSeenAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"             TIMESTAMP(3),
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Device_identityKeyEd25519_key" ON "Device"("identityKeyEd25519");
CREATE INDEX        "Device_userId_revokedAt_idx"   ON "Device"("userId", "revokedAt");

ALTER TABLE "Device"
  ADD CONSTRAINT "Device_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceOneTimeKey" (
  "id"        TEXT         NOT NULL,
  "deviceId"  TEXT         NOT NULL,
  "keyId"     TEXT         NOT NULL,
  "publicKey" TEXT         NOT NULL,
  "signature" TEXT         NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceOneTimeKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceOneTimeKey_deviceId_keyId_key"    ON "DeviceOneTimeKey"("deviceId", "keyId");
CREATE INDEX        "DeviceOneTimeKey_deviceId_claimedAt_idx" ON "DeviceOneTimeKey"("deviceId", "claimedAt");

ALTER TABLE "DeviceOneTimeKey"
  ADD CONSTRAINT "DeviceOneTimeKey_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceFallbackKey" (
  "id"        TEXT         NOT NULL,
  "deviceId"  TEXT         NOT NULL,
  "keyId"     TEXT         NOT NULL,
  "publicKey" TEXT         NOT NULL,
  "signature" TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "DeviceFallbackKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceFallbackKey_deviceId_keyId_key"    ON "DeviceFallbackKey"("deviceId", "keyId");
CREATE INDEX        "DeviceFallbackKey_deviceId_retiredAt_idx" ON "DeviceFallbackKey"("deviceId", "retiredAt");

ALTER TABLE "DeviceFallbackKey"
  ADD CONSTRAINT "DeviceFallbackKey_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. ChatEnvelope table (per-recipient-device ciphertext).
CREATE TABLE "ChatEnvelope" (
  "id"                TEXT         NOT NULL,
  "chatId"            TEXT         NOT NULL,
  "recipientUserId"   TEXT         NOT NULL,
  "recipientDeviceId" TEXT         NOT NULL,
  "ciphertext"        TEXT         NOT NULL,
  "messageType"       INTEGER      NOT NULL DEFAULT 1,
  "read"              BOOLEAN      NOT NULL DEFAULT false,
  "deliveredAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatEnvelope_chatId_recipientDeviceId_key"      ON "ChatEnvelope"("chatId", "recipientDeviceId");
CREATE INDEX        "ChatEnvelope_recipientDeviceId_read_idx"        ON "ChatEnvelope"("recipientDeviceId", "read");
CREATE INDEX        "ChatEnvelope_recipientUserId_createdAt_idx"     ON "ChatEnvelope"("recipientUserId", "createdAt");

ALTER TABLE "ChatEnvelope"
  ADD CONSTRAINT "ChatEnvelope_chatId_fkey"
    FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ChatEnvelope_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ChatEnvelope_recipientDeviceId_fkey"
    FOREIGN KEY ("recipientDeviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Attach Chat to sender + sender device now that Device exists.
CREATE INDEX "Chat_senderDeviceId_idx" ON "Chat"("senderDeviceId");
CREATE INDEX "Chat_roomId_createdAt_idx" ON "Chat"("roomId", "createdAt");

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_senderUserId_fkey"
    FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Chat_senderDeviceId_fkey"
    FOREIGN KEY ("senderDeviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
