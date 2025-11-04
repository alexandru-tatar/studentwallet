import { ApiProperty } from '@nestjs/swagger';
import BigNumber from 'bignumber.js';
import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsISO8601, IsOptional, Validate,
    type ValidationArguments,
    ValidatorConstraint,
    type ValidatorConstraintInterface
} from 'class-validator';

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

export class WalletDTO {
  @Transform(number2Money)
  @Validate(DecimalMin, [BigNumber(0)], { message: 'balance must be \u2265 0.' })
  @ApiProperty({ example: 25.5, type: Number })
  readonly balance!: BigNumber;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: false, required: false, type: Boolean })
  readonly autoReloadEnabled?: boolean;

  @IsOptional()
  @Transform(number2Money)
  @Validate(DecimalMin, [BigNumber(0)], { message: 'autoReloadThreshold must be \u2265 0.' })
  @ApiProperty({ example: 5, required: false, type: Number })
  readonly autoReloadThreshold?: BigNumber;

  @IsOptional()
  @Transform(number2Money)
  @Validate(DecimalMin, [BigNumber(0)], { message: 'autoReloadAmount must be \u2265 0.' })
  @ApiProperty({ example: 10, required: false, type: Number })
  readonly autoReloadAmount?: BigNumber;

  @IsOptional()
  @IsISO8601({ strict: true })
  @ApiProperty({ example: '2025-01-15T10:30:00.000Z', required: false })
  readonly lastReloaded?: string | Date;
}