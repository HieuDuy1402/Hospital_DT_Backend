import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';

@Controller('tts')
export class TTSController {
    @Get()
    async getAudio(@Query('text') text: string, @Res() res: Response) {
        if (!text) {
            return res.status(400).send('Missing text parameter');
        }

        try {
            const encodedText = encodeURIComponent(text);
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${encodedText}`;

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'http://translate.google.com/',
                }
            });

            res.set({
                'Content-Type': 'audio/mpeg',
                'Transfer-Encoding': 'chunked',
            });

            response.data.pipe(res);
        } catch (error) {
            console.error('TTS Proxy Error:', error);
            res.status(500).send('Error fetching audio');
        }
    }
}
