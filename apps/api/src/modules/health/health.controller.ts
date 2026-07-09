import { Controller, Get } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { HealthResponseDto } from './dto/health-response.dto';

@Controller('health')
export class HealthController {
	@Get()
	check(): HealthResponseDto {
		return plainToInstance(HealthResponseDto, {
			status: 'ok',
			uptimeSeconds: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
		});
	}
}
