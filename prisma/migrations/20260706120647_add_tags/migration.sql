-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_MaterialTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MaterialTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MaterialTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_PatternTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_PatternTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Pattern" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PatternTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_MaterialTags_AB_unique" ON "_MaterialTags"("A", "B");

-- CreateIndex
CREATE INDEX "_MaterialTags_B_index" ON "_MaterialTags"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PatternTags_AB_unique" ON "_PatternTags"("A", "B");

-- CreateIndex
CREATE INDEX "_PatternTags_B_index" ON "_PatternTags"("B");
