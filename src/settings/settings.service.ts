import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    async getSettings() {
        const settings = await this.prisma.systemSetting.findMany();
        // Convert array to object key-value
        return settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    }

    async updateSettings(data: { key: string; value: string }[]) {
        // Upsert each setting
        for (const item of data) {
            await this.prisma.systemSetting.upsert({
                where: { key: item.key },
                update: { value: item.value },
                create: { key: item.key, value: item.value },
            });
        }
        return this.getSettings();
    }

    async getSetting(key: string): Promise<string | null> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key },
        });
        return setting?.value || null;
    }
}
