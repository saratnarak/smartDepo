import { Module } from '@nestjs/common';

import { AuditLogController } from './audit-log.controller.js';
import { AuditLogService } from './audit-log.service.js';
import { PlatformAuditLogController } from './platform-audit-log.controller.js';

@Module({
  controllers: [AuditLogController, PlatformAuditLogController],
  providers: [AuditLogService],
})
export class AuditLogModule {}
