import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userConnections = new Map<string, number>();
  private socketToUser = new Map<string, string>();
  private offlineTimeouts = new Map<string, NodeJS.Timeout>();
  private isGlobalSpeaking = false;
  private speakingCounterId: number | null = null;
  private voiceLockTimeout: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) { }

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.socketToUser.set(client.id, userId);

      // Cancel any pending offline timeout
      if (this.offlineTimeouts.has(userId)) {
        clearTimeout(this.offlineTimeouts.get(userId));
        this.offlineTimeouts.delete(userId);
      }

      const count = this.userConnections.get(userId) || 0;
      this.userConnections.set(userId, count + 1);

      // Set online if first connection
      if (count === 0) {
        try {
          await this.prisma.user.update({
            where: { id: userId },
            data: { isOnline: true }
          });
          this.emitQueueUpdate();
        } catch (error) {
          console.error(`Error setting user ${userId} online on connection:`, error);
        }
      }

      console.log(`User ${userId} connected. Total connections: ${count + 1}`);

      // Send current voice state to the new client
      client.emit('voiceStatusUpdate', {
        isSpeaking: this.isGlobalSpeaking,
        counterId: this.speakingCounterId
      });
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      const count = (this.userConnections.get(userId) || 1) - 1;
      this.socketToUser.delete(client.id);
      this.userConnections.set(userId, count);

      if (count <= 0) {
        // Debounce offline status to handle page refreshes
        const timeout = setTimeout(async () => {
          this.userConnections.delete(userId);
          this.offlineTimeouts.delete(userId);
          console.log(`User ${userId} truly disconnected. Setting offline.`);

          try {
            await this.prisma.user.update({
              where: { id: userId },
              data: { isOnline: false }
            });
            this.emitQueueUpdate();
          } catch (error) {
            console.error(`Error setting user ${userId} offline:`, error);
          }
        }, 3000); // 3 second delay

        this.offlineTimeouts.set(userId, timeout);
      }
    }
  }

  emitQueueUpdate() {
    this.server.emit('queueUpdate');
  }

  emitTicketCalled(ticket: any) {
    this.server.emit('ticketCalled', ticket);
  }

  @SubscribeMessage('voiceStarted')
  handleVoiceStarted(@MessageBody() data: { counterId: number }) {
    this.isGlobalSpeaking = true;
    this.speakingCounterId = data.counterId;

    // Broadcast to everyone
    this.server.emit('voiceStatusUpdate', {
      isSpeaking: true,
      counterId: data.counterId
    });

    // Safety timeout: clear lock after 10 seconds if not finished
    if (this.voiceLockTimeout) clearTimeout(this.voiceLockTimeout);
    this.voiceLockTimeout = setTimeout(() => {
      this.clearVoiceLock();
    }, 10000);
  }

  @SubscribeMessage('voiceFinished')
  handleVoiceFinished() {
    this.clearVoiceLock();
  }

  private clearVoiceLock() {
    if (this.voiceLockTimeout) {
      clearTimeout(this.voiceLockTimeout);
      this.voiceLockTimeout = null;
    }
    this.isGlobalSpeaking = false;
    this.speakingCounterId = null;
    this.server.emit('voiceStatusUpdate', {
      isSpeaking: false,
      counterId: null
    });
  }

  isSpeaking() {
    return this.isGlobalSpeaking;
  }
}
