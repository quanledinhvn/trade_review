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
import { DOCUMENT_TYPE_VALUES } from '../../../domain/document-type';
import { PACKAGING_TYPE_VALUES } from '../../../domain/packaging-type';

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
	@IsString()
	@IsNotEmpty()
	case_reference!: string;

	@IsString()
	@IsNotEmpty()
	shipment_reference!: string;

	@IsString()
	@IsNotEmpty()
	importer!: string;

	@IsString()
	@IsNotEmpty()
	arrival_date!: string;

	@IsInt()
	@Min(1)
	review_window_days!: number;

	@IsNumber()
	invoice_value!: number;

	@IsIn(PACKAGING_TYPE_VALUES)
	packaging_type!: string;

	@IsBoolean()
	ispm15_certified!: boolean;

	@IsArray()
	@ArrayNotEmpty()
	@IsIn(DOCUMENT_TYPE_VALUES, { each: true })
	required_documents!: string[];

	@IsArray()
	@IsIn(DOCUMENT_TYPE_VALUES, { each: true })
	@Validate(CompletedDocumentsSubsetConstraint)
	completed_documents!: string[];

	@IsString()
	@IsNotEmpty()
	assigned_team!: string;

	@IsOptional()
	@IsString()
	assigned_user?: string;
}
