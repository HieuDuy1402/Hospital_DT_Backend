import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Counter } from '@prisma/client';

@Injectable()
export class CountersService {
    constructor(private prisma: PrismaService) { }

    async findAll(): Promise<Counter[]> {
        return this.prisma.counter.findMany({
            orderBy: { id: 'asc' },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        isOnline: true,
                    },
                },
            },
        });
    }

    async findOne(id: number): Promise<Counter | null> {
        return this.prisma.counter.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        isOnline: true,
                    },
                },
            },
        });
    }

    async create(data: Prisma.CounterCreateInput): Promise<Counter> {
        // Check if name exists
        const existing = await this.prisma.counter.findFirst({
            where: { name: data.name }
        });
        if (existing) {
            throw new BadRequestException('Tên quầy đã tồn tại');
        }

        // Find the lowest available ID (to reuse deleted IDs)
        const allCounters = await this.prisma.counter.findMany({
            orderBy: { id: 'asc' },
            select: { id: true }
        });

        let nextId = 1;
        for (const counter of allCounters) {
            if (counter.id === nextId) {
                nextId++;
            } else {
                // Found a gap, use this ID
                break;
            }
        }

        // Create counter with specific ID
        return this.prisma.counter.create({
            data: {
                id: nextId,
                ...data,
            },
        });
    }

    async update(id: number, data: Prisma.CounterUpdateInput): Promise<Counter> {
        return this.prisma.counter.update({
            where: { id },
            data,
        });
    }

    async remove(id: number): Promise<Counter> {
        return this.prisma.counter.delete({
            where: { id },
        });
    }
}
