import { Module } from '@nestjs/common';
import { ValidatorsService } from './validators.service';
import { ValidatorsController } from './validators.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [ValidatorsController],
  providers: [ValidatorsService],
})
export class ValidatorsModule {}
