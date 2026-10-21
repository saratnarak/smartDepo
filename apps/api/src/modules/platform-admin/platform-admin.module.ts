import { Module } from '@nestjs/common';

import { PlatformAdminController } from './platform-admin.controller.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { PlatformDashboardController } from './platform-dashboard.controller.js';

@Module({
  controllers: [PlatformAdminController, PlatformDashboardController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
