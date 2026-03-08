
import { PrismaClient } from '@video-platform/database';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying Prisma Client models...');

    try {
        // Check if models exist on the client instance
        if (!('music' in prisma)) {
            throw new Error('Model "Music" not found in PrismaClient');
        }
        if (!('article' in prisma)) {
            throw new Error('Model "Article" not found in PrismaClient');
        }

        console.log('Models found. Attempting to count records...');
        const musicCount = await prisma.music.count();
        const articleCount = await prisma.article.count();

        console.log(`Music count: ${musicCount}`);
        console.log(`Article count: ${articleCount}`);
        console.log('Verification SUCCESS');
    } catch (e) {
        console.error('Verification FAILED:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
