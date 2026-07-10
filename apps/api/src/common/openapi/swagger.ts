import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle('Shipment Trade Review API')
		.setDescription('API documentation for time-sensitive shipment trade review workflows.')
		.setVersion('1.0.0')
		.addServer('http://localhost:3000', 'Local API server')
		.build();

	const document = SwaggerModule.createDocument(app, config);

	SwaggerModule.setup('docs', app, document, {
		jsonDocumentUrl: 'docs-json',
		swaggerOptions: {
			persistAuthorization: true,
		},
	});
}
