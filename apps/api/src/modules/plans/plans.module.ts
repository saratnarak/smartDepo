import { Module } from '@nestjs/common';

import { DepotPlanController } from './depot-plan.controller.js';
import { PlatformPlansController } from './platform-plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  controllers: [DepotPlanController, PlatformPlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
