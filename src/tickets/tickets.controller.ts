import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query, ParseIntPipe, Delete } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketStatus, TicketType, Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tickets')
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    @Post() // Public endpoint for Kiosk
    create(@Body('type') type: TicketType) {
        return this.ticketsService.create(type);
    }

    @Get()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.COUNTER, Role.DISPLAY)
    findAll(@Query('status') status?: TicketStatus) {
        return this.ticketsService.findAll(status);
    }

    @Get('calling')
    getCallingTickets() {
        return this.ticketsService.getCallingTickets();
    }

    @Get('waiting')
    getWaitingTickets(@Query('limit') limit?: string) {
        return this.ticketsService.getWaitingTickets(limit ? parseInt(limit) : 10);
    }

    @Get('stats')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN)
    getStatistics() {
        return this.ticketsService.getStatistics();
    }

    @Post('call-next')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.COUNTER, Role.ADMIN)
    callNext(
        @Body('counterId', ParseIntPipe) counterId: number,
        @Body('type') type?: TicketType
    ) {
        return this.ticketsService.callNext(counterId, type);
    }

    @Patch(':id/status')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.COUNTER, Role.ADMIN)
    updateStatus(@Param('id') id: string, @Body('status') status: TicketStatus) {
        return this.ticketsService.updateStatus(id, status);
    }

    @Post('recall')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.COUNTER, Role.ADMIN)
    recall(@Body('id') id: string) {
        return this.ticketsService.recall(id);
    }

    @Delete('clear-waiting')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN)
    deleteAllWaiting() {
        console.log('API Request: Delete all waiting tickets');
        return this.ticketsService.deleteAllWaiting();
    }

    @Delete('all')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN)
    deleteAll() {
        return this.ticketsService.deleteAll();
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN)
    delete(@Param('id') id: string) {
        return this.ticketsService.delete(id);
    }
}
