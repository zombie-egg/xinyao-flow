CREATE TYPE "EmailCodePurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET');

ALTER TABLE "EmailVerification"
ADD COLUMN "purpose" "EmailCodePurpose" NOT NULL DEFAULT 'REGISTER';
