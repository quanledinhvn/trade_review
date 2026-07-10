import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ApiRequestIdHeader } from '../../common/openapi/headers';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@ApiRequestIdHeader()
@Controller('health')
export class HealthController {
	@Get()
	@ApiOperation({ summary: 'Check API health' })
	@ApiOkResponse({ type: HealthResponseDto })
	check(): HealthResponseDto {
		return plainToInstance(HealthResponseDto, {
			status: 'ok',
			uptimeSeconds: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
		});
	}
}
