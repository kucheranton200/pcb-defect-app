ALTER TABLE "Defect" ADD COLUMN "title" TEXT;

WITH numbered AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number,
        REPLACE(INITCAP(REPLACE("className", '_', ' ')), ' ', '') AS normalized_class
    FROM "Defect"
)
UPDATE "Defect"
SET "title" = CONCAT(
    numbered.row_number,
    '-Defect-',
    numbered.normalized_class,
    '-',
    SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)
)
FROM numbered
WHERE "Defect"."id" = numbered."id";

ALTER TABLE "Defect" ALTER COLUMN "title" SET NOT NULL;
CREATE UNIQUE INDEX "Defect_title_key" ON "Defect"("title");
