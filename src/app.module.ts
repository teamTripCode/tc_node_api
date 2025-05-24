import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { P2pModule } from './p2p/p2p.module';
import { ConfigModule } from '@nestjs/config';
import { ValidatorsModule } from './validators/validators.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    P2pModule,
    ValidatorsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
