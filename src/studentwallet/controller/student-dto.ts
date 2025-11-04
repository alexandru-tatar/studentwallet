// Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

/* eslint-disable max-classes-per-file, @typescript-eslint/no-magic-numbers */

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min, ValidateNested
} from 'class-validator';
import { TransactionDTO } from './transaction-dto.js';
import { WalletDTO } from './wallet-dto.js';

export const MAX_RATING = 5;

/**
 * Entity-Klasse für Student ohne Referenzen.
 */
export class StudentDtoOhneRef {
  @IsString()
  @Matches(/^[A-Z0-9]{5,20}$/u, {
    message: 'matriculationNumber: Großbuchstaben/Ziffern, 5-20 Zeichen',
  })
  @ApiProperty({ example: '85625', type: String })
  readonly matriculationNumber!: string;

  @IsString()
  @ApiProperty({ example: 'Max', type: String })
  readonly firstName!: string;

  @IsString()
  @ApiProperty({ example: 'Mustermann', type: String })
  readonly lastName!: string;

  @IsEmail()
  @ApiProperty({ example: 'max.mustermann@stud.hs-karlsruhe.de', type: String })
  readonly email!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @ApiProperty({ example: 3, type: Number })
  readonly semester!: number;
}

/**
 * Entity-Klasse für Bücher.
 */
export class StudentDTO extends StudentDtoOhneRef {
    @ValidateNested()
    @Type(() => WalletDTO)
    @ApiProperty({ type: WalletDTO })
    readonly wallet!: WalletDTO;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TransactionDTO)
    @ApiProperty({ type: [TransactionDTO] })
    readonly transactions: TransactionDTO[] | undefined;
}
/* eslint-enable max-classes-per-file, @typescript-eslint/no-magic-numbers */
