-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "cdnUrlCN" TEXT,
ADD COLUMN     "cdnUrlGlobal" TEXT,
ADD COLUMN     "transcodeStatus" TEXT,
ADD COLUMN     "transcodedUrls" JSONB;
