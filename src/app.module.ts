import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CountersModule } from './counters/counters.module';
import { TicketsModule } from './tickets/tickets.module';
import { GatewayModule } from './gateway/gateway.module';
import { SettingsModule } from './settings/settings.module';
import { TTSModule } from './tts/tts.module';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CountersModule,
    TicketsModule,
    GatewayModule,
    SettingsModule,
    TTSModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
