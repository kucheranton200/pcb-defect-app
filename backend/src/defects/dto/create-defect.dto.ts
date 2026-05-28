import { IsNumberString, IsString, MinLength } from 'class-validator';

export class CreateDefectDto {
  @IsString()
  @MinLength(1)
  className: string;

  @IsNumberString()
  confidence: string;

  @IsNumberString()
  boxX1: string;

  @IsNumberString()
  boxY1: string;

  @IsNumberString()
  boxX2: string;

  @IsNumberString()
  boxY2: string;
}
