import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator.js';
import { HealthStatusDto } from './dto/health-status.dto.js';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Check that the API process is running' })
  @ApiOkResponse({ type: HealthStatusDto })
  check(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
