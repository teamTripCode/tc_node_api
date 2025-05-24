
export interface ValidatorNode {
  address: string;
  nodeType: string;
  lastSeen: string;
  isResponding: boolean;
  version?: string;
}

export interface TransactionRequest {
  from: string;
  to: string;
  amount: number;
  signature?: string;
  timestamp?: string;
}

export interface BatchTransactionRequest {
  transactions: TransactionRequest[];
}

export interface CriticalProcessRequest {
  processId: string;
  data: any;
  priority: number;
  timestamp?: string;
}

export interface BlockchainStatus {
  height: number;
  lastBlockHash: string;
  difficulty: number;
  totalTransactions: number;
}

export interface MempoolStatus {
  pendingTransactions: number;
  totalSize: number;
  oldestTransaction?: string;
}

export interface ValidatorResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  validatorAddress: string;
}

export interface Block {
  index: number;
  timestamp: string;
  transactions: any[];
  hash: string;
  previousHash: string;
  nonce: number;
}

export enum ValidatorEndpoints {
  PING = '/ping',
  TX = '/tx',
  TX_BATCH = '/tx/batch',
  CRITICAL = '/critical',
  STATUS_TX = '/status/tx',
  STATUS_CRITICAL = '/status/critical',
  CHAIN_TX = '/chain/tx',
  CHAIN_CRITICAL = '/chain/critical',
  MEMPOOL_TX = '/mempool/tx',
  MEMPOOL_CRITICAL = '/mempool/critical',
  BLOCK_TX = '/block/tx',
  BLOCK_CRITICAL = '/block/critical',
}