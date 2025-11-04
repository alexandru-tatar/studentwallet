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
 * Das Modul besteht aus der Klasse {@linkcode StudentwalletService}.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
    Prisma,
    PrismaClient,
    StudentwalletFile,
} from '../../generated/prisma/client.js';
import { TransactionType } from '../../generated/prisma/enums.js';
import { getLogger } from '../../logger/logger.js';
import { type Pageable } from './pageable.js';
import { PrismaService } from './prisma-service.js';
import { type Slice } from './slice.js';
import { type Suchparameter, suchparameterNamen } from './suchparameter.js';
import { WhereBuilder } from './where-builder.js';

export type StudentMitWallet = Prisma.StudentGetPayload<{
    include: { wallet: true };
}>;

export type StudentMitWalletUndTransaktionen = Prisma.StudentGetPayload<{
    include: {
        wallet: true;
        transactions: true;
    };
}>;

/**
 * Die Klasse `StudentwalletService` implementiert das Lesen für Studenten und
 * greift mit Prisma auf eine relationale DB zu.
 */
@Injectable()
export class StudentwalletService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #prisma: PrismaClient;
    readonly #whereBuilder: WhereBuilder;
    readonly #includeWallet = { wallet: true } as const;
    readonly #includeWalletUndTransaktionen = { wallet: true, transactions: true } as const;

    readonly #logger = getLogger(StudentwalletService.name);

    constructor(prisma: PrismaService, whereBuilder: WhereBuilder) {
        this.#prisma = prisma.client;
        this.#whereBuilder = whereBuilder;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Einen Studenten asynchron anhand seiner ID suchen.
     * @param id ID des gesuchten Studenten.
     * @returns Den gefundenen Studenten inklusive Wallet und Transaktionen.
     * @throws NotFoundException falls kein Student mit der ID existiert.
     */
    async findById({
        id,
    }: {
        readonly id: number;
    }): Promise<Readonly<StudentMitWalletUndTransaktionen>> {
        this.#logger.debug('findById: id=%d', id);

        // Das Resultat ist null, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const student: StudentMitWalletUndTransaktionen | null = await this.#prisma.student.findUnique(
            {
                where: { id },
                include: this.#includeWalletUndTransaktionen,
            },
        );
        if (student === null) {
            this.#logger.debug('Es gibt keinen Studenten mit der ID %d', id);
            throw new NotFoundException(
                `Es gibt keinen Studenten mit der ID ${id}.`,
            );
        }

        this.#logger.debug('findById: student=%o', student);
        return student;
    }

    /**
     * Binärdatei zu einem Studenten suchen.
     * @param studentId ID des zugehörigen Studenten.
     * @returns Binärdatei oder undefined als Promise.
     */
    async findFileByBuchId(
        studentId: number,
    ): Promise<Readonly<StudentwalletFile> | undefined> {
        this.#logger.debug('findFileByStudentId: studentId=%d', studentId);
        const studentFile: StudentwalletFile | null =
            await this.#prisma.studentwalletFile.findUnique({ where: { studentId } });
        if (studentFile === null) {
            this.#logger.debug('findFileByStudentId: Keine Datei gefunden');
            return;
        }

        this.#logger.debug(
            'findFileByStudentId: id=%s, byteLength=%d, filename=%s, mimetype=%s, studentId=%d',
            studentFile.id,
            studentFile.data.byteLength,
            studentFile.filename,
            studentFile.mimetype ?? 'undefined',
            studentFile.studentId,
        );

        // als Datei im Wurzelverzeichnis des Projekts speichern:
        // import { writeFile } from 'node:fs/promises';
        // await writeFile(buchFile.filename, buchFile.data);

        return studentFile;
    }

    /**
     * Studenten asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparametern.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Slice mit den gefundenen Studenten.
     * @throws NotFoundException falls keine Studenten gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | undefined,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<StudentMitWallet>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === undefined) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundException('Ungueltige Suchparameter');
        }

        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const where = this.#whereBuilder.build(suchparameter);
        const { number, size } = pageable;
        const studenten: StudentMitWallet[] = await this.#prisma.student.findMany({
            where,
            skip: number * size,
            take: size,
            include: this.#includeWallet,
        });
        if (studenten.length === 0) {
            this.#logger.debug('find: Keine Studenten gefunden');
            throw new NotFoundException(
                `Keine Studenten gefunden: ${JSON.stringify(
                    suchparameter,
                )}, Seite ${pageable.number}`,
            );
        }
        const totalElements = await this.count();
        return this.#createSlice(studenten, totalElements);
    }

    /**
     * Anzahl aller Studenten zurückliefern.
     * @returns Anzahl der Studenten.
     */
    async count() {
        this.#logger.debug('count');
        const count = await this.#prisma.student.count();
        this.#logger.debug('count: %d', count);
        return count;
    }

    async #findAll(pageable: Pageable): Promise<Readonly<Slice<StudentMitWallet>>> {
        const { number, size } = pageable;
        const studenten: StudentMitWallet[] = await this.#prisma.student.findMany({
            skip: number * size,
            take: size,
            include: this.#includeWallet,
        });
        if (studenten.length === 0) {
            this.#logger.debug('#findAll: Keine Studenten gefunden');
            throw new NotFoundException(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(studenten, totalElements);
    }

    #createSlice(
        studenten: StudentMitWallet[],
        totalElements: number,
    ): Readonly<Slice<StudentMitWallet>> {
        const studentSlice: Slice<StudentMitWallet> = {
            content: studenten,
            totalElements,
        };
        this.#logger.debug('createSlice: studentSlice=%o', studentSlice);
        return studentSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        const validKeys = keys.every(
            (key) => suchparameterNamen.includes(key) || key === 'art',
        );
        if (!validKeys) {
            this.#logger.debug('#checkKeys: ungueltige keys=%o', keys);
        }
        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { art } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "art=%s"',
            art ?? 'undefined',
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return (
            art === undefined ||
            (Object.values(TransactionType) as ReadonlyArray<string>).includes(
                art as string,
            )
        );
    }
}
