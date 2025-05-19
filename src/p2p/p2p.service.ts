import { Injectable, Logger } from '@nestjs/common';
import {  RegistrationStatus, SeedNodeConfig } from './dto/seed-node.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class P2pService {
  private readonly logger = new Logger(P2pService.name);
  private config: SeedNodeConfig;
  private nodeAddress: string;
  private connected = false;
  private registrationStatus = RegistrationStatus.NOT_REGISTERED;
  private lastPingTime: Date | null = null;
  private pingIntervalRef: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private reconnectIntervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Load configuration
    this.config = {
      seedNodeAddress: this.configService.get<string>('SEED_NODE_ADDRESS') || 'localhost:3000',
      nodePort: this.configService.get<number>('NODE_PORT') || 3100,
      nodeHost: this.configService.get<string>('NODE_HOST') || 'localhost',
      pingInterval: this.configService.get<number>('PING_INTERVAL') || 30000, // 30 seconds
      reconnectInterval: this.configService.get<number>('RECONNECT_INTERVAL') || 10000, // 10 seconds
      maxReconnectAttempts: this.configService.get<number>('MAX_RECONNECT_ATTEMPTS') || 5,
    };

    this.nodeAddress = `${this.config.nodeHost}:${this.config.nodePort}`;
    this.logger.log(`Node address: ${this.nodeAddress}`);
    this.logger.log(`Seed node address: ${this.config.seedNodeAddress}`);
  }

  async onModuleInit() {
    this.logger.log('Initializing Seed Node service...');
    await this.connectToSeedNode();
    
    // Start ping interval to maintain connection
    this.startPingInterval();
  }

  onModuleDestroy() {
    this.logger.log('Shutting down Seed Node service...');
    this.stopPingInterval();
    this.stopReconnectInterval();
  }

  private startPingInterval() {
    this.stopPingInterval(); // Clear any existing interval
    
    this.pingIntervalRef = setInterval(async () => {
      await this.pingSeedNode();
    }, this.config.pingInterval);
    
    this.logger.log(`Ping interval started (every ${this.config.pingInterval / 1000} seconds)`);
  }

  private stopPingInterval() {
    if (this.pingIntervalRef) {
      clearInterval(this.pingIntervalRef);
      this.pingIntervalRef = null;
    }
  }

  private startReconnectInterval() {
    this.stopReconnectInterval(); // Clear any existing interval
    
    this.reconnectIntervalRef = setInterval(async () => {
      if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        this.logger.error(`Maximum reconnect attempts (${this.config.maxReconnectAttempts}) reached. Stopping reconnect attempts.`);
        this.stopReconnectInterval();
        return;
      }
      
      this.reconnectAttempts++;
      this.logger.log(`Attempting to reconnect to seed node (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
      await this.connectToSeedNode();
      
      if (this.connected) {
        this.logger.log('Reconnected successfully!');
        this.stopReconnectInterval();
        this.reconnectAttempts = 0;
      }
    }, this.config.reconnectInterval);
    
    this.logger.log(`Reconnect interval started (every ${this.config.reconnectInterval / 1000} seconds)`);
  }

  private stopReconnectInterval() {
    if (this.reconnectIntervalRef) {
      clearInterval(this.reconnectIntervalRef);
      this.reconnectIntervalRef = null;
    }
  }

  async connectToSeedNode() {
    try {
      // First, try to ping the seed node to check if it's available
      const pingResult = await this.pingSeedNode();
      
      if (!pingResult) {
        this.logger.error('Seed node is not responding to ping');
        this.handleConnectionFailure();
        return false;
      }

      // Try to register this node with the seed node
      await this.registerWithSeedNode();
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to seed node: ${error.message}`);
      this.handleConnectionFailure();
      return false;
    }
  }

  private handleConnectionFailure() {
    this.connected = false;
    
    if (!this.reconnectIntervalRef) {
      this.startReconnectInterval();
    }
  }

  async pingSeedNode(): Promise<boolean> {
    try {
      this.logger.debug(`Pinging seed node at ${this.config.seedNodeAddress}...`);
      
      const response = await firstValueFrom(
        this.httpService.get(`http://${this.config.seedNodeAddress}/ping`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Ping failed: ${error.message}`);
            throw error;
          }),
        ),
      );

      if (response.status === 200) {
        this.connected = true;
        this.lastPingTime = new Date();
        this.logger.debug('Ping successful');
        return true;
      }
      
      this.connected = false;
      this.logger.warn(`Ping returned non-200 status: ${response.status}`);
      return false;
    } catch (error) {
      this.connected = false;
      this.logger.error(`Error during ping: ${error.message}`);
      
      // If we were connected and now we're not, start reconnection attempts
      if (this.connected) {
        this.handleConnectionFailure();
      }
      
      return false;
    }
  }

  async registerWithSeedNode(): Promise<boolean> {
    try {
      this.registrationStatus = RegistrationStatus.REGISTERING;
      this.logger.log(`Registering node ${this.nodeAddress} with seed node...`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `http://${this.config.seedNodeAddress}/register`,
          JSON.stringify(this.nodeAddress),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Registration failed: ${error.message}`);
            this.registrationStatus = RegistrationStatus.FAILED;
            throw error;
          }),
        ),
      );

      if (response.status === 201) {
        this.logger.log('Node registered successfully!');
        this.registrationStatus = RegistrationStatus.REGISTERED;
        return true;
      } else if (response.status === 200) {
        this.logger.log('Node was already registered, connection successful');
        this.registrationStatus = RegistrationStatus.REGISTERED;
        return true;
      } else {
        this.logger.warn(`Registration returned unexpected status: ${response.status}`);
        this.registrationStatus = RegistrationStatus.FAILED;
        return false;
      }
    } catch (error) {
      this.logger.error(`Error during registration: ${error.message}`);
      this.registrationStatus = RegistrationStatus.FAILED;
      return false;
    }
  }

  async getKnownNodes(): Promise<string[]> {
    try {
      if (!this.connected) {
        return [];
      }
      
      const response = await firstValueFrom(
        this.httpService.get(`http://${this.config.seedNodeAddress}/nodes`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to get nodes list: ${error.message}`);
            throw error;
          }),
        ),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting nodes list: ${error.message}`);
      return [];
    }
  }

  async getActiveNodes(): Promise<string[]> {
    try {
      if (!this.connected) {
        return [];
      }
      
      const response = await firstValueFrom(
        this.httpService.get(`http://${this.config.seedNodeAddress}/nodes/active`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to get active nodes list: ${error.message}`);
            throw error;
          }),
        ),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting active nodes list: ${error.message}`);
      return [];
    }
  }

  // Public getters for status information
  isConnected(): boolean {
    return this.connected;
  }

  getNodeAddress(): string {
    return this.nodeAddress;
  }

  getSeedNodeAddress(): string {
    return this.config.seedNodeAddress;
  }

  getLastPingTime(): Date | null {
    return this.lastPingTime;
  }

  getRegistrationStatus(): RegistrationStatus {
    return this.registrationStatus;
  }
}
