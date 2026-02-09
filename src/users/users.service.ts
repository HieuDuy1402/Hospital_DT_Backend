import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { QueueGateway } from '../gateway/gateway.gateway';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private queueGateway: QueueGateway
    ) { }

    async findOne(username: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { username },
        });
    }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return this.prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
            },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                username: true,
                role: true,
                counterId: true,
                isOnline: true,
                createdAt: true,
            },
        });
    }

    async updateOnlineStatus(id: string, isOnline: boolean): Promise<User> {
        const user = await this.prisma.user.update({
            where: { id },
            data: { isOnline },
        });

        // Notify all clients to refresh (display will show Tạm đóng)
        this.queueGateway.emitQueueUpdate();

        return user;
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        if (data.password) {
            data.password = await bcrypt.hash(data.password as string, 10);
        }
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async remove(id: string): Promise<User> {
        return this.prisma.user.delete({
            where: { id },
        });
    }
}
