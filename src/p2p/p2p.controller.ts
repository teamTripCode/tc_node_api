import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { P2pService } from './p2p.service';

@Controller('p2p')
export class P2pController {
  constructor(private readonly p2pService: P2pService) { }

  @Get('status')
  async getStatus() {
    return {
      connected: this.p2pService.isConnected(),
      nodeAddress: this.p2pService.getNodeAddress(),
      seedNodeAddress: this.p2pService.getSeedNodeAddress(),
      lastPingTime: this.p2pService.getLastPingTime(),
      registrationStatus: this.p2pService.getRegistrationStatus(),
    };
  }

  @Get('nodes')
  async getNodes() {
    return this.p2pService.getKnownNodes();
  }

  @Get('active-nodes')
  async getActiveNodes() {
    return this.p2pService.getActiveNodes();
  }
}
