ALTER TABLE "public"."User" ADD COLUMN "email" TEXT;
ALTER TABLE "public"."User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

CREATE TABLE "public"."EmailVerification" (
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("email")
);
