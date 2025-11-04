// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { Module } from '@nestjs/common';
import { KeycloakModule } from '../security/keycloak/module.js';
import { StudentwalletController } from './controller/studentwallet-controller.js';
import { StudentWriteController } from './controller/studentwallet-write-controller.js';
import { PrismaService } from './service/prisma-service.js';
import { StudentwalletService } from './service/studentwallet-service.js';
import { StudentwalletWriteService } from './service/studentwallet-write-service.js';
import { WhereBuilder } from './service/where-builder.js';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Bücher.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für Prisma.
 */
@Module({
    imports: [KeycloakModule],
    controllers: [StudentwalletController, StudentWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        StudentwalletService,
        StudentwalletWriteService,
        PrismaService,
        WhereBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [StudentwalletService, StudentwalletWriteService],
})
export class StudentModule {}
