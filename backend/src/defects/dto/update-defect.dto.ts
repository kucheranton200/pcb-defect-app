import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDefectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsNumber()
  boxX1?: number;

  @IsOptional()
  @IsNumber()
  boxY1?: number;

  @IsOptional()
  @IsNumber()
  boxX2?: number;

  @IsOptional()
  @IsNumber()
  boxY2?: number;
}
