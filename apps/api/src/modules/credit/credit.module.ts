import { Module } from '@nestjs/common';

import { CreditController } from './credit.controller.js';
import { CreditService } from './credit.service.js';

@Module({
  controllers: [CreditController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditModule {}
