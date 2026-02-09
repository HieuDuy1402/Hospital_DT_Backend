import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CountersService } from './counters.service';
import { Prisma, Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('counters')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CountersController {
    constructor(private readonly countersService: CountersService) { }

    @Get()
    findAll() {
        return this.countersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.countersService.findOne(id);
    }

    @Post()
    @Roles(Role.ADMIN)
    create(@Body() data: Prisma.CounterCreateInput) {
        return this.countersService.create(data);
    }

    @Patch(':id')
    @Roles(Role.ADMIN)
    update(@Param('id', ParseIntPipe) id: number, @Body() data: Prisma.CounterUpdateInput) {
        return this.countersService.update(id, data);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.countersService.remove(id);
    }
}
