CREATE TABLE "public"."CustomerActivity" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerActivity_customerId_createdAt_idx" ON "public"."CustomerActivity"("customerId", "createdAt");

ALTER TABLE "public"."CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."CustomerActivity" ADD CONSTRAINT "CustomerActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
