import { Module } from '@nestjs/common';

import { DepotSettingsController } from './depot-settings.controller.js';
import { DepotSettingsService } from './depot-settings.service.js';

@Module({
  controllers: [DepotSettingsController],
  providers: [DepotSettingsService],
})
export class DepotsModule {}
