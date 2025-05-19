export interface SeedNodeConfig {
  seedNodeAddress: string;
  nodePort: number;
  nodeHost: string;
  pingInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

export interface NodeInfo {
  address: string;
  lastSeen: string;
  isResponding: boolean;
  version?: string;
}

export enum RegistrationStatus {
  NOT_REGISTERED = 'NOT_REGISTERED',
  REGISTERING = 'REGISTERING',
  REGISTERED = 'REGISTERED',
  FAILED = 'FAILED',
}