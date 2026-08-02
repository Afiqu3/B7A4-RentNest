/*
  Warnings:

  - Added the required column `image` to the `properties` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- AlterTable
-- 1. Add column with temporary default value for existing rows
ALTER TABLE "properties" ADD COLUMN "image" TEXT NOT NULL DEFAULT 'https://unsplash.com/photos/building-exterior-with-square-windows-and-multiple-air-conditioners-viyJmIh7x1o';

-- 2. Drop the default constraint so future inserts are forced to pass an image
ALTER TABLE "properties" ALTER COLUMN "image" DROP DEFAULT;

