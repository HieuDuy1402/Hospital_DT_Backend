import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Ticket, TicketStatus, TicketType } from '@prisma/client';
import { QueueGateway } from '../gateway/gateway.gateway';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);

    constructor(
        private prisma: PrismaService,
        private queueGateway: QueueGateway,
        private settingsService: SettingsService,
    ) { }

    async create(type: TicketType = 'NORMAL'): Promise<Ticket> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get the latest ticket number for today
        const lastTicket = await this.prisma.ticket.findFirst({
            where: {
                createdAt: {
                    gte: today,
                },
            },
            orderBy: {
                number: 'desc',
            },
        });

        const nextNumber = lastTicket ? lastTicket.number + 1 : 1;

        // Get prefix based on type
        const settings = await this.settingsService.getSettings();
        const prefix = type === 'PRIORITY' ? (settings['prefix_priority'] || 'P-') : (settings['prefix_normal'] || '');
        const displayNumber = `${prefix}${nextNumber}`;

        const ticket = await this.prisma.ticket.create({
            data: {
                number: nextNumber,
                displayNumber,
                type,
                status: 'WAITING',
            },
        });

        this.queueGateway.emitQueueUpdate();
        return ticket;
    }

    async findAll(status?: TicketStatus) {
        return this.prisma.ticket.findMany({
            where: status ? { status } : {},
            include: {
                counter: {
                    include: {
                        users: {
                            select: {
                                isOnline: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    async getCallingTickets() {
        return this.prisma.ticket.findMany({
            where: {
                status: 'CALLING',
            },
            include: {
                counter: true,
            },
            orderBy: {
                calledAt: 'desc',
            },
        });
    }

    async getWaitingTickets(limit = 10) {
        return this.prisma.ticket.findMany({
            where: {
                status: 'WAITING',
            },
            orderBy: [
                { type: 'desc' }, // PRIORITY first
                { createdAt: 'asc' },
            ],
            take: limit,
        });
    }

    async callNext(counterId: number, type?: TicketType): Promise<Ticket | null> {
        // Check if counter is active
        const counter = await this.prisma.counter.findUnique({ where: { id: counterId } });
        if (!counter || counter.status !== 'ACTIVE') {
            throw new BadRequestException('Counter is not active or does not exist');
        }

        // Check global voice lock
        if (this.queueGateway.isSpeaking()) {
            throw new BadRequestException('Vui lòng đợi thông báo trước đó kết thúc');
        }

        // Auto-complete any existing CALLING ticket for this counter
        const existingCallingTicket = await this.prisma.ticket.findFirst({
            where: {
                status: 'CALLING',
                counterId: counterId,
            },
        });

        if (existingCallingTicket) {
            await this.prisma.ticket.update({
                where: { id: existingCallingTicket.id },
                data: {
                    status: 'COMPLETED',
                    finishedAt: new Date(),
                },
            });
            // Update persistent statistics
            await this.incrementStats(existingCallingTicket.type);
        }

        // Find next waiting ticket (Priority first if type not specified)
        const nextTicket = await this.prisma.ticket.findFirst({
            where: {
                status: 'WAITING',
                ...(type ? { type } : {}),
            },
            orderBy: [
                { type: 'desc' }, // PRIORITY first
                { createdAt: 'asc' },
            ],
        });

        if (!nextTicket) {
            if (existingCallingTicket) {
                this.queueGateway.emitQueueUpdate();
            }
            throw new BadRequestException('Không có bệnh nhân đang chờ');
        }

        // Update status to CALLING
        const ticket = await this.prisma.ticket.update({
            where: { id: nextTicket.id },
            data: {
                status: 'CALLING',
                counterId,
                calledAt: new Date(),
            },
            include: {
                counter: true,
            },
        });

        this.queueGateway.emitTicketCalled(ticket);
        this.queueGateway.emitQueueUpdate();
        return ticket;
    }

    async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
        const ticket = await this.prisma.ticket.findUnique({ where: { id } });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const updateData: Prisma.TicketUpdateInput = { status };
        if (status === 'COMPLETED' || status === 'SKIPPED') {
            updateData.finishedAt = new Date();
        }

        const updatedTicket = await this.prisma.ticket.update({
            where: { id },
            data: updateData,
            include: {
                counter: true,
            },
        });

        this.queueGateway.emitQueueUpdate();

        // Update statistics if completed
        if (status === 'COMPLETED') {
            await this.incrementStats(updatedTicket.type);
        }

        return updatedTicket;
    }

    async recall(id: string): Promise<Ticket> {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: { counter: true },
        });

        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        if (ticket.status !== 'CALLING') {
            throw new BadRequestException('Can only recall calling tickets');
        }

        // Just re-emit the event
        this.queueGateway.emitTicketCalled(ticket);
        return ticket;
    }

    async delete(id: string) {
        try {
            await this.prisma.ticket.delete({ where: { id } });
            this.queueGateway.emitQueueUpdate();
            return { success: true };
        } catch (error) {
            throw new NotFoundException('Ticket not found');
        }
    }

    async deleteAllWaiting() {
        const result = await this.prisma.ticket.deleteMany({
            where: { status: 'COMPLETED' },
        });
        this.queueGateway.emitQueueUpdate();
        return result;
    }

    async deleteAll() {
        const result = await this.prisma.ticket.deleteMany({});
        this.queueGateway.emitQueueUpdate();
        return result;
    }

    // Automatically clear tickets at 00:00 every day
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyCleanup() {
        this.logger.log('Starting daily queue cleanup (Midnight)...');
        try {
            const result = await this.prisma.ticket.deleteMany({});
            this.logger.log(`Daily cleanup successful. Cleared ${result.count} tickets.`);
            this.queueGateway.emitQueueUpdate();
        } catch (error) {
            this.logger.error('Error during daily cleanup:', error);
        }
    }

    private async incrementStats(type: TicketType) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.ticketStats.upsert({
            where: {
                date_type: {
                    date: today,
                    type,
                },
            },
            update: {
                count: {
                    increment: 1,
                },
            },
            create: {
                date: today,
                type,
                count: 1,
            },
        });
    }

    async getStatistics() {
        const stats = await this.prisma.ticketStats.findMany({
            orderBy: {
                date: 'desc',
            },
        });

        // Group by day, but also provide totals for current month and year
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let todayStats = { NORMAL: 0, PRIORITY: 0 };
        let monthStats = { NORMAL: 0, PRIORITY: 0 };
        let yearStats = { NORMAL: 0, PRIORITY: 0 };

        stats.forEach(s => {
            const sDate = new Date(s.date);

            if (sDate.getTime() === today.getTime()) {
                todayStats[s.type] += s.count;
            }

            if (sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear) {
                monthStats[s.type] += s.count;
            }

            if (sDate.getFullYear() === currentYear) {
                yearStats[s.type] += s.count;
            }
        });

        return {
            today: todayStats,
            month: monthStats,
            year: yearStats,
            history: stats,
        };
    }
}
