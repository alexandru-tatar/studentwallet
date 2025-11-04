import { ApiProperty } from '@nestjs/swagger';
import BigNumber from 'bignumber.js';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { TransactionType } from '../../generated/prisma/enums.js';

const number2Money = ({ value }: { value: BigNumber.Value | undefined }) => {
  if (value === undefined) return;
  BigNumber.set({ DECIMAL_PLACES: 2 });
  return BigNumber(value);
};

@ValidatorConstraint({ name: 'decimalMin', async: false })
class DecimalMin implements ValidatorConstraintInterface {
  validate(value: BigNumber | undefined, args: ValidationArguments) {
    if (value === undefined) return true;
    const [minValue]: BigNumber[] = args.constraints as unknown as BigNumber[];
    return value.isGreaterThan(minValue!) || value.isEqualTo(minValue!);
  }
  defaultMessage(args: ValidationArguments) {
    return `Value should be \u2264 ${(args.constraints[0] as BigNumber).toNumber()} .`;
  }
}

export class TransactionDTO {
  @Transform(number2Money)
  @Validate(DecimalMin, [BigNumber(0.01)], { message: 'amount muss > 0 sein.' })
  @ApiProperty({ example: 3.5, type: Number })
  readonly amount!: BigNumber;

  @ApiProperty({ enum: TransactionType, example: 'SPEND' })
  readonly type!: TransactionType;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Mensa A - Mittagessen', required: false })
  readonly reference?: string | null;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Mensa/SelfService', required: false })
  readonly location?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  @ApiProperty({ example: '2025-02-10T12:15:00.000Z', required: false })
  readonly recordedAt?: string | Date;
}