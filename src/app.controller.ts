import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('ping')
  ping() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'TripCodeChain Client Node'
    };
  }
}
