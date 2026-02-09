import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const counterPassword = await bcrypt.hash('counter1', 10);
    const displayPassword = await bcrypt.hash('display123', 10);

    // Create Admin
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: adminPassword,
            role: 'ADMIN',
        },
    });

    // Create Counters
    const counters = [
        { name: 'Quầy 1', description: 'Tiếp nhận bệnh nhân' },
        { name: 'Quầy 2', description: 'Khám tổng quát' },
        { name: 'Quầy 3', description: 'Thu phí' },
    ];

    for (const c of counters) {
        await prisma.counter.upsert({
            where: { id: counters.indexOf(c) + 1 },
            update: {},
            create: {
                id: counters.indexOf(c) + 1,
                name: c.name,
                description: c.description,
                status: 'ACTIVE',
            },
        });
    }

    // Create Counter User
    await prisma.user.upsert({
        where: { username: 'counter1' },
        update: {},
        create: {
            username: 'counter1',
            password: counterPassword,
            role: 'COUNTER',
            counterId: 1,
        },
    });

    // Create Display User
    await prisma.user.upsert({
        where: { username: 'display' },
        update: {},
        create: {
            username: 'display',
            password: displayPassword,
            role: 'DISPLAY',
        },
    });

    console.log('Seed completed successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
