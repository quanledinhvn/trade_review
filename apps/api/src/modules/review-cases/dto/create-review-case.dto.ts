import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Min,
	Validate,
	ValidatorConstraint,
	type ValidationArguments,
	type ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_TYPE_VALUES } from '../../../domain/document-type';
import { PACKAGING_TYPE_VALUES } from '../../../domain/packaging';

@ValidatorConstraint({ name: 'completedDocumentsSubset', async: false })
class CompletedDocumentsSubsetConstraint implements ValidatorConstraintInterface {
	validate(completedDocuments: string[], args: ValidationArguments): boolean {
		const object = args.object as CreateReviewCaseDto;

		return completedDocuments.every((doc) => object.required_documents.includes(doc));
	}

	defaultMessage(): string {
		return 'completed_documents must be a subset of required_documents';
	}
}

export class CreateReviewCaseDto {
	@ApiProperty({ example: 'REV-2026-0119' })
	@IsString()
	@IsNotEmpty()
	case_reference!: string;

	@ApiProperty({ example: 'SHP-2026-0119' })
	@IsString()
	@IsNotEmpty()
	shipment_reference!: string;

	@ApiProperty({ example: 'Safiri Imports Ltd.' })
	@IsString()
	@IsNotEmpty()
	importer!: string;

	@ApiProperty({ example: '2026-01-19', description: 'Arrival date in YYYY-MM-DD format.' })
	@IsString()
	@IsNotEmpty()
	arrival_date!: string;

	@ApiProperty({ example: 2, minimum: 1 })
	@IsInt()
	@Min(1)
	review_window_days!: number;

	@ApiProperty({ example: 125000 })
	@IsNumber()
	invoice_value!: number;

	@ApiProperty({ enum: PACKAGING_TYPE_VALUES, example: 'wooden_crate' })
	@IsIn(PACKAGING_TYPE_VALUES)
	packaging_type!: string;

	@ApiProperty({ example: false })
	@IsBoolean()
	ispm15_certified!: boolean;

	@ApiProperty({
		enum: DOCUMENT_TYPE_VALUES,
		isArray: true,
		example: ['commercial_invoice', 'packing_list', 'transport_document'],
	})
	@IsArray()
	@ArrayNotEmpty()
	@IsIn(DOCUMENT_TYPE_VALUES, { each: true })
	required_documents!: string[];

	@ApiProperty({
		enum: DOCUMENT_TYPE_VALUES,
		isArray: true,
		example: ['commercial_invoice', 'packing_list'],
		description: 'Must be a subset of required_documents.',
	})
	@IsArray()
	@IsIn(DOCUMENT_TYPE_VALUES, { each: true })
	@Validate(CompletedDocumentsSubsetConstraint)
	completed_documents!: string[];

	@ApiProperty({ example: 'trade_operations' })
	@IsString()
	@IsNotEmpty()
	assigned_team!: string;

	@ApiPropertyOptional({ example: 'reviewer-1' })
	@IsOptional()
	@IsString()
	assigned_user?: string;
}
