import { Module } from '@nestjs/common';
import { TTSController } from './tts.controller';

@Module({
    controllers: [TTSController],
})
export class TTSModule { }
