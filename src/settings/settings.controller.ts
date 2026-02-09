import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get()
    @Roles(Role.ADMIN)
    async getSettings() {
        return this.settingsService.getSettings();
    }

    @Post()
    @Roles(Role.ADMIN)
    async updateSettings(@Body() data: { key: string; value: string }[]) {
        return this.settingsService.updateSettings(data);
    }
}
