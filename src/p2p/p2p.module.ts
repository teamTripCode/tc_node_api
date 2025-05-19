import { Module } from '@nestjs/common';
import { P2pService } from './p2p.service';
import { P2pController } from './p2p.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    })
  ],
  controllers: [P2pController],
  providers: [P2pService],
})
export class P2pModule {}
