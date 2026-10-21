import { Module } from '@nestjs/common';

import { StockController } from './stock.controller.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [StockController],
  providers: [StockService, StockLedgerService],
  exports: [StockLedgerService],
})
export class StockModule {}
