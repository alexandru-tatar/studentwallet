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

// Aufruf:   node --env-file=.env src\beispiele.mts

import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import { PrismaClient, type Prisma, type Student } from './generated/prisma/client.ts';
import {
    type StudentInclude,
    type StudentWhereInput,
} from './generated/prisma/models/Student.ts';

console.log(`process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`);
console.log('');

const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
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

// SELECT *
// FROM   student
// JOIN   wallet   ON wallet.student_id = student.id
// WHERE  wallet.balance > 10
const where: StudentWhereInput = {
    wallet: {
        balance: {
            gt: 10,
        },
    },
};

// Fetch-Joins mit Daten aus "wallet" und "transactions"
const includeWalletTransactions: StudentInclude = {
    wallet: true,
    transactions: true,
};
export type StudentMitWalletUndTransaktionen = Prisma.StudentGetPayload<{
    include: {
        wallet: true;
        transactions: true;
    };
}>;

// Operationen mit dem Model "Student"
try {
    await prisma.$connect();

    // Das Resultat ist null, falls kein Datensatz gefunden
    const student: Student | null = await prisma.student.findUnique({ where: { id: 1 } });
    console.log(`student=${JSON.stringify(student)}`);
    console.log('');

    // Fetch-Join mit Wallet und Transaktionen
    const students: StudentMitWalletUndTransaktionen[] = await prisma.student.findMany({
        where,
        include: includeWalletTransactions,
    });
    console.log(`studentsMitWallet=${JSON.stringify(students)}`);
    console.log('');

    const kontostaende = students.map((s) => s.wallet?.balance);
    console.log(`kontostaende=${JSON.stringify(kontostaende)}`);
    console.log('');

    const transaktionsSummen = students.map(
        (s) => s.transactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) ?? 0,
    );
    console.log(`transaktionsSummen=${JSON.stringify(transaktionsSummen)}`);
    console.log('');

    // Pagination
    const studentsPage2: Student[] = await prisma.student.findMany({
        skip: 5,
        take: 5,
    });
    console.log(`studentsPage2=${JSON.stringify(studentsPage2)}`);
    console.log('');
} finally {
    await prisma.$disconnect();
}

// PrismaClient mit PostgreSQL-User "postgres", d.h. mit Administrationsrechten
const adapterAdmin = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
});
const prismaAdmin = new PrismaClient({ adapter: adapterAdmin });
try {
    const studentsAdmin: Student[] = await prismaAdmin.student.findMany({ where });
    console.log(`studentsAdmin=${JSON.stringify(studentsAdmin)}`);
} finally {
    await prismaAdmin.$disconnect();
}

/* eslint-enable n/no-process-env */
