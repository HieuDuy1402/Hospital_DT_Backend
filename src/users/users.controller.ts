import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma, Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN, Role.COUNTER, Role.DISPLAY)
    findAll() {
        return this.usersService.findAll();
    }

    @Post()
    @Roles(Role.ADMIN)
    create(@Body() data: Prisma.UserCreateInput) {
        return this.usersService.create(data);
    }

    @Patch(':id')
    @Roles(Role.ADMIN)
    update(@Param('id') id: string, @Body() data: Prisma.UserUpdateInput) {
        return this.usersService.update(id, data);
    }

    @Patch(':id/status')
    @Roles(Role.ADMIN, Role.COUNTER) // Allow counter users to update their own status
    updateStatus(@Param('id') id: string, @Body('isOnline') isOnline: boolean) {
        return this.usersService.updateOnlineStatus(id, isOnline);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.usersService.remove(id);
    }
}
