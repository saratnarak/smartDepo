import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService, DashboardService],
  exports: [ReportsService, DashboardService],
})
export class ReportsModule {}
