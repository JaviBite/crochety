-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- Los usuarios existentes (las dos fundadoras) pasan a ser administradoras
-- para no quedarse fuera del nuevo panel de administración.
UPDATE "User" SET "role" = 'ADMIN';

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
