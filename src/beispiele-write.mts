/* eslint-disable n/no-process-env */
// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
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
// along with this program. If not, see <http://www.gnu.org/licenses/>.

// Aufruf:   node --env-file=.env src\beispiele-write.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import { PrismaClient, type Prisma } from './generated/prisma/client.ts';

console.log(`process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`);
console.log('');

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});
// PrismaClient fuer DB "campus_wallet" 
const prisma = new PrismaClient({
    adapter,
    errorFormat: 'pretty',
    log: [
        {
            emit: 'event',
            level: 'query',
        },
        'info',
        'warn',
        'error',
    ],
});
prisma.$on('query', (e) => {
    console.log(`Query: ${e.query}`);
    console.log(`Duration: ${e.duration} ms`);
});

const neuerStudent: Prisma.StudentCreateInput = {
    // Spaltentyp "text"
    matriculationNumber: '85625',
    firstName: 'Alex',
    lastName: 'Beispiel',
    email: 'alex.beispiel@stud.hs-ka.de',
    // Spaltentyp "integer"
    semester: 2,
    // 1:1-Beziehung
    wallet: {
        create: {
            balance: 42.15,
            autoReloadEnabled: false,
            autoReloadThreshold: 15,
            autoReloadAmount: 25,
        },
    },
    // 1:N-Beziehung
    transactions: {
        create: [
            {
                amount: 25,
                type: 'LOAD',
                reference: 'Ersteinzahlung',
                location: 'Online-Portal',
            },
            {
                amount: -3.8,
                type: 'SPEND',
                reference: 'Kaffee',
                location: 'Cafeteria',
            },
        ],
    },
};
type StudentCreated = Prisma.StudentGetPayload<{
    include: {
        wallet: true;
        transactions: true;
    };
}>;

const geaenderterStudent: Prisma.StudentUpdateInput = {
    version: { increment: 1 },
    semester: 3,
    email: 'alexander.beispiel@stud.hs-ka.de',
    wallet: {
        update: {
            balance: { increment: 10 },
            autoReloadEnabled: true,
        },
    },
};
type StudentUpdated = Prisma.StudentGetPayload<{}>; // eslint-disable-line @typescript-eslint/no-empty-object-type

// Schreib-Operationen mit dem Model "Student"
try {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
        // Neuer Datensatz mit generierter ID
        const studentDb: StudentCreated = await tx.student.create({
            data: neuerStudent,
            include: { wallet: true, transactions: true },
        });
        console.log(`Generierte ID: ${studentDb.id}`);
        console.log('');

        // Version +1 wegen "Optimistic Locking" bzw. Vermeidung von "Lost Updates"
        const studentUpdated: StudentUpdated = await tx.student.update({
            data: geaenderterStudent,
            where: { id: 30 },
        });
        console.log(`Aktualisierte Version: ${studentUpdated.version}`);
        console.log('');

        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions#referential-action-defaults
        // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode
        const geloescht = await tx.student.delete({ where: { id: 70 } });
        console.log(`Geloescht: ${geloescht.id}`);
    });
} finally {
    await prisma.$disconnect();
}
/* eslint-enable n/no-process-env */
