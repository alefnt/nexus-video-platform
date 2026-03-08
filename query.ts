import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { address: { not: null } },
                { did: { not: null } },
            ],
        },
        select: {
            id: true,
            address: true,
            did: true,
            username: true,
            nickname: true,
        },
    });
    console.log(JSON.stringify(users, null, 2));
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
