import { Injectable, Logger } from '@nestjs/common';
import {
  BatchTransactionRequest,
  BlockchainStatus,
  CriticalProcessRequest,
  MempoolStatus,
  TransactionRequest,
  ValidatorEndpoints,
  ValidatorNode,
  ValidatorResponse
} from './dto/create-validator.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class ValidatorsService {
  private readonly logger = new Logger(ValidatorsService.name);
  private validatorNodes: ValidatorNode[] = [];
  private seedNodeAddress: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.seedNodeAddress = this.configService.get<string>('SEED_NODE_ADDRESS') || 'localhost:3000';
    this.logger.log(`Validator service initialized with seed node: ${this.seedNodeAddress}`);
  }

  async onModuleInit() {
    this.logger.log('Initializing Validator service...');
    await this.loadValidatorNodes();
    this.startHealthCheckInterval();
  }

  onModuleDestroy() {
    this.logger.log('Shutting down Validator service...');
    this.stopHealthCheckInterval();
  }

  private startHealthCheckInterval() {
    this.stopHealthCheckInterval();

    // Check validator nodes health every 60 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.checkValidatorNodesHealth();
    }, 60000);

    this.logger.log('Validator health check interval started');
  }

  private stopHealthCheckInterval() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Load validator nodes from the seed node
   */
  async loadValidatorNodes(): Promise<ValidatorNode[]> {
    try {
      this.logger.log('Loading validator nodes from seed node...');

      const response = await firstValueFrom(
        this.httpService.get(`http://${this.seedNodeAddress}/nodes/active`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to load validator nodes: ${error.message}`);
            throw error;
          }),
        ),
      );

      // Filter only validator nodes
      const allNodes = response.data as ValidatorNode[];
      this.validatorNodes = allNodes.filter(node => node.nodeType === 'validator');

      this.logger.log(`Loaded ${this.validatorNodes.length} validator nodes`);
      return this.validatorNodes;
    } catch (error) {
      this.logger.error(`Error loading validator nodes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all known validator nodes
   */
  getValidatorNodes(): ValidatorNode[] {
    return this.validatorNodes;
  }

  /**
   * Get only responding validator nodes
   */
  getActiveValidatorNodes(): ValidatorNode[] {
    return this.validatorNodes.filter(node => node.isResponding);
  }

  /**
   * Check health of all validator nodes
   */
  private async checkValidatorNodesHealth(): Promise<void> {
    this.logger.debug('Checking validator nodes health...');

    const healthCheckPromises = this.validatorNodes.map(async (node) => {
      try {
        const isHealthy = await this.pingValidator(node.address);
        node.isResponding = isHealthy;
        if (isHealthy) {
          node.lastSeen = new Date().toISOString();
        }
      } catch (error) {
        node.isResponding = false;
        this.logger.warn(`Validator node ${node.address} is not responding`);
      }
    });

    await Promise.allSettled(healthCheckPromises);

    const activeCount = this.getActiveValidatorNodes().length;
    this.logger.debug(`Health check completed. ${activeCount}/${this.validatorNodes.length} validators are active`);
  }

  /**
   * Ping a specific validator node
   */
  async pingValidator(validatorAddress: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://${validatorAddress}${ValidatorEndpoints.PING}`, {
          timeout: 5000,
        }).pipe(
          catchError((error: AxiosError) => {
            throw error;
          }),
        ),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.debug(`Ping failed for validator ${validatorAddress}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send transaction to validators
   */
  async sendTransaction(transaction: TransactionRequest): Promise<ValidatorResponse[]> {
    const activeValidators = this.getActiveValidatorNodes();

    if (activeValidators.length === 0) {
      this.logger.warn('No active validators available for transaction');
      return [];
    }

    this.logger.log(`Sending transaction to ${activeValidators.length} validators`);

    const promises = activeValidators.map(async (validator) => {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `http://${validator.address}${ValidatorEndpoints.TX}`,
            transaction,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 10000,
            },
          ).pipe(
            map(res => ({
              success: true,
              data: res.data,
              timestamp: new Date().toISOString(),
              validatorAddress: validator.address,
            } as ValidatorResponse)),
            catchError((error: AxiosError) => {
              return [{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                validatorAddress: validator.address,
              } as ValidatorResponse];
            }),
          ),
        );

        return response;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          validatorAddress: validator.address,
        } as ValidatorResponse;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: 'Promise rejected',
        timestamp: new Date().toISOString(),
        validatorAddress: 'unknown',
      }
    );
  }

  /**
   * Send batch transactions to validators
   */
  async sendBatchTransactions(batchRequest: BatchTransactionRequest): Promise<ValidatorResponse[]> {
    const activeValidators = this.getActiveValidatorNodes();

    if (activeValidators.length === 0) {
      this.logger.warn('No active validators available for batch transactions');
      return [];
    }

    this.logger.log(`Sending batch of ${batchRequest.transactions.length} transactions to ${activeValidators.length} validators`);

    const promises = activeValidators.map(async (validator) => {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `http://${validator.address}${ValidatorEndpoints.TX_BATCH}`,
            batchRequest,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
            },
          ).pipe(
            map(res => ({
              success: true,
              data: res.data,
              timestamp: new Date().toISOString(),
              validatorAddress: validator.address,
            } as ValidatorResponse)),
            catchError((error: AxiosError) => {
              return [{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                validatorAddress: validator.address,
              } as ValidatorResponse];
            }),
          ),
        );

        return response;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          validatorAddress: validator.address,
        } as ValidatorResponse;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: 'Promise rejected',
        timestamp: new Date().toISOString(),
        validatorAddress: 'unknown',
      }
    );
  }

  /**
   * Send critical process to validators
   */
  async sendCriticalProcess(criticalRequest: CriticalProcessRequest): Promise<ValidatorResponse[]> {
    const activeValidators = this.getActiveValidatorNodes();

    if (activeValidators.length === 0) {
      this.logger.warn('No active validators available for critical process');
      return [];
    }

    this.logger.log(`Sending critical process to ${activeValidators.length} validators`);

    const promises = activeValidators.map(async (validator) => {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `http://${validator.address}${ValidatorEndpoints.CRITICAL}`,
            criticalRequest,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 20000,
            },
          ).pipe(
            map(res => ({
              success: true,
              data: res.data,
              timestamp: new Date().toISOString(),
              validatorAddress: validator.address,
            } as ValidatorResponse)),
            catchError((error: AxiosError) => {
              return [{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                validatorAddress: validator.address,
              } as ValidatorResponse];
            }),
          ),
        );

        return response;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          validatorAddress: validator.address,
        } as ValidatorResponse;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: 'Promise rejected',
        timestamp: new Date().toISOString(),
        validatorAddress: 'unknown',
      }
    );
  }

  /**
   * Get blockchain status from validators
   */
  async getBlockchainStatus(chain: 'tx' | 'critical' = 'tx'): Promise<ValidatorResponse<BlockchainStatus>[]> {
    const activeValidators = this.getActiveValidatorNodes();

    if (activeValidators.length === 0) {
      return [];
    }

    const endpoint = chain === 'tx' ? ValidatorEndpoints.STATUS_TX : ValidatorEndpoints.STATUS_CRITICAL;

    const promises = activeValidators.map(async (validator) => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`http://${validator.address}${endpoint}`, {
            timeout: 10000,
          }).pipe(
            map(res => ({
              success: true,
              data: res.data as BlockchainStatus,
              timestamp: new Date().toISOString(),
              validatorAddress: validator.address,
            } as ValidatorResponse<BlockchainStatus>)),
            catchError((error: AxiosError) => {
              return [{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                validatorAddress: validator.address,
              } as ValidatorResponse<BlockchainStatus>];
            }),
          ),
        );

        return response;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          validatorAddress: validator.address,
        } as ValidatorResponse<BlockchainStatus>;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: 'Promise rejected',
        timestamp: new Date().toISOString(),
        validatorAddress: 'unknown',
      }
    );
  }

  /**
   * Get mempool status from validators
   */
  async getMempoolStatus(pool: 'tx' | 'critical' = 'tx'): Promise<ValidatorResponse<MempoolStatus>[]> {
    const activeValidators = this.getActiveValidatorNodes();

    if (activeValidators.length === 0) {
      return [];
    }

    const endpoint = pool === 'tx' ? ValidatorEndpoints.MEMPOOL_TX : ValidatorEndpoints.MEMPOOL_CRITICAL;

    const promises = activeValidators.map(async (validator) => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`http://${validator.address}${endpoint}`, {
            timeout: 10000,
          }).pipe(
            map(res => ({
              success: true,
              data: res.data as MempoolStatus,
              timestamp: new Date().toISOString(),
              validatorAddress: validator.address,
            } as ValidatorResponse<MempoolStatus>)),
            catchError((error: AxiosError) => {
              return [{
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                validatorAddress: validator.address,
              } as ValidatorResponse<MempoolStatus>];
            }),
          ),
        );

        return response;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          validatorAddress: validator.address,
        } as ValidatorResponse<MempoolStatus>;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: 'Promise rejected',
        timestamp: new Date().toISOString(),
        validatorAddress: 'unknown',
      }
    );
  }

  /**
   * Refresh validator nodes list
   */
  async refreshValidatorNodes(): Promise<ValidatorNode[]> {
    this.logger.log('Refreshing validator nodes list...');
    return await this.loadValidatorNodes();
  }
}
