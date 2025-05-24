import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ValidatorsService } from './validators.service';
import { BatchTransactionRequest, CriticalProcessRequest, TransactionRequest } from './dto/create-validator.dto';

@Controller('validators')
export class ValidatorsController {
  constructor(private readonly validatorService: ValidatorsService) { }

  @Get()
  async getValidators() {
    return {
      validators: this.validatorService.getValidatorNodes(),
      total: this.validatorService.getValidatorNodes().length,
      active: this.validatorService.getActiveValidatorNodes().length,
    };
  }

  @Get('active')
  async getActiveValidators() {
    return {
      validators: this.validatorService.getActiveValidatorNodes(),
      count: this.validatorService.getActiveValidatorNodes().length,
    };
  }

  @Post('refresh')
  async refreshValidators() {
    const validators = await this.validatorService.refreshValidatorNodes();
    return {
      message: 'Validator nodes refreshed',
      validators,
      total: validators.length,
    };
  }

  @Get('ping/:address')
  async pingValidator(@Param('address') address: string) {
    const isResponding = await this.validatorService.pingValidator(address);
    return {
      address,
      responding: isResponding,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('transaction')
  async sendTransaction(@Body() transaction: TransactionRequest) {
    const results = await this.validatorService.sendTransaction(transaction);
    return {
      message: 'Transaction sent to validators',
      results,
      successCount: results.filter(r => r.success).length,
      totalValidators: results.length,
    };
  }

  @Post('transaction/batch')
  async sendBatchTransactions(@Body() batchRequest: BatchTransactionRequest) {
    const results = await this.validatorService.sendBatchTransactions(batchRequest);
    return {
      message: `Batch of ${batchRequest.transactions.length} transactions sent to validators`,
      results,
      successCount: results.filter(r => r.success).length,
      totalValidators: results.length,
    };
  }

  @Post('critical')
  async sendCriticalProcess(@Body() criticalRequest: CriticalProcessRequest) {
    const results = await this.validatorService.sendCriticalProcess(criticalRequest);
    return {
      message: 'Critical process sent to validators',
      results,
      successCount: results.filter(r => r.success).length,
      totalValidators: results.length,
    };
  }

  @Get('blockchain/status')
  async getBlockchainStatus(@Query('chain') chain?: 'tx' | 'critical') {
    const results = await this.validatorService.getBlockchainStatus(chain || 'tx');
    return {
      chain: chain || 'tx',
      results,
      respondingValidators: results.filter(r => r.success).length,
      totalQueried: results.length,
    };
  }

  @Get('mempool/status')
  async getMempoolStatus(@Query('pool') pool?: 'tx' | 'critical') {
    const results = await this.validatorService.getMempoolStatus(pool || 'tx');
    return {
      pool: pool || 'tx',
      results,
      respondingValidators: results.filter(r => r.success).length,
      totalQueried: results.length,
    };
  }
}
