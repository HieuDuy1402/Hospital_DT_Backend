import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { GatewayModule } from '../gateway/gateway.module';

import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GatewayModule, SettingsModule],
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule { }
