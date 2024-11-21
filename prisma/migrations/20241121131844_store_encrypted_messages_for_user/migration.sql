-- CreateTable
CREATE TABLE "UserChatEncryptedMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserChatEncryptedMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserChatEncryptedMessage" ADD CONSTRAINT "UserChatEncryptedMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChatEncryptedMessage" ADD CONSTRAINT "UserChatEncryptedMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
