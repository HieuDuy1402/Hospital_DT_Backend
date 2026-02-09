import { Module } from '@nestjs/common';
import { QueueGateway } from './gateway.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [QueueGateway],
  exports: [QueueGateway],
})
export class GatewayModule { }
