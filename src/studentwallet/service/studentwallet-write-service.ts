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
 * Das Modul besteht aus der Klasse {@linkcode BuchWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
    PrismaClient,
    StudentwalletFile,
    type Prisma,
} from '../../generated/prisma/client.js';
import { getLogger } from '../../logger/logger.js';
import {
    MatrNrExistsException,
    VersionInvalidException,
    VersionOutdatedException,
} from './exceptions.js';
import { PrismaService } from './prisma-service.js';
import { StudentwalletService } from './studentwallet-service.js';

export type StudentCreate = Prisma.StudentCreateInput;
type StudentCreated = Prisma.StudentGetPayload<{
    include: {
        wallet: true;
        transactions: true;
    };
}>;

export type StudentUpdate = Prisma.StudentUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Buches mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Buches. */
    readonly id: number | undefined;
    /** Buch-Objekt mit den aktualisierten Werten. */
    readonly student: StudentUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};
type StudentUpdated = Prisma.StudentGetPayload<{}>;

type StudentFileCreate = Prisma.StudentwalletFileUncheckedCreateInput;
export type StudentFileCreated = Prisma.StudentwalletFileGetPayload<{}>;

/**
 * Die Klasse `BuchWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _Prisma_ auf die DB zu.
 */
@Injectable()
export class StudentwalletWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #prisma: PrismaClient;

    readonly #readService: StudentwalletService;

    readonly #logger = getLogger(StudentwalletWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        prisma: PrismaService,
        readService: StudentwalletService,
    ) {
        this.#prisma = prisma.client;
        this.#readService = readService;
    }

    /**
     * Ein neues Buch soll angelegt werden.
     * @param student Das neu abzulegende Buch
     * @returns Die ID des neu angelegten Buches
     * @throws IsbnExists falls die ISBN-Nummer bereits existiert
     */
    async create(student: StudentCreate) {
        this.#logger.debug('create: student=%o', student);
        await this.#validateCreate(student);

        // Neuer Datensatz mit generierter ID
        let studentDb: StudentCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            studentDb = await tx.student.create({
                data: student,
                include: { wallet: true, transactions: true },
            });
        });

        this.#logger.debug('create: studentDb.id=%s', studentDb?.id ?? 'N/A');
        return studentDb?.id ?? Number.NaN;
    }

    /**
     * Zu einem vorhandenen Buch eine Binärdatei mit z.B. einem Bild abspeichern.
     * @param buchId ID des vorhandenen Buches
     * @param data Bytes der Datei als Buffer Node
     * @param filename Dateiname
     * @param size Dateigröße in Bytes
     * @returns Entity-Objekt für `BuchFile`
     */
    // eslint-disable-next-line max-params
    async addFile(
        studentId: number,
        data: Uint8Array,
        filename: string,
        size: number,
    ): Promise<Readonly<StudentwalletFile> | undefined> {
        this.#logger.debug(
            'addFile: studentId=%d, filename=%s, size=%d',
            studentId,
            filename,
            size,
        );

        // TODO Dateigroesse pruefen

        let studentFileCreated: StudentFileCreated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            // Buch ermitteln, falls vorhanden
            const buch = tx.student.findUnique({
                where: { id: studentId },
            });
            if (buch === null) {
                this.#logger.debug('Es gibt kein Student mit der ID %d', studentId);
                throw new NotFoundException(
                    `Es gibt kein Buch mit der ID ${studentId}.`,
                );
            }

            // evtl. vorhandene Datei löschen
            await tx.studentwalletFile.deleteMany({ where: { studentId } });

            const fileType = await fileTypeFromBuffer(data);
            const mimetype = fileType?.mime ?? null;
            this.#logger.debug('addFile: mimetype=%s', mimetype ?? 'undefined');

            const binaryData = new Uint8Array(data);

            const studentwalletFile: StudentFileCreate = {
                filename,
                data: binaryData,
                mimetype,
                studentId,
            };
            studentFileCreated = await tx.studentwalletFile.create({ data: studentwalletFile });
        });

        this.#logger.debug(
            'addFile: id=%d, byteLength=%d, filename=%s, mimetype=%s',
            studentFileCreated?.id ?? Number.NaN,
            studentFileCreated?.data.byteLength ?? Number.NaN,
            studentFileCreated?.filename ?? 'undefined',
            studentFileCreated?.mimetype ?? 'null',
        );
        return studentFileCreated;
    }

    /**
     * Ein vorhandenes Buch soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Buchs), buch (zu aktualisierendes Buch)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Buch zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, student, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%d, buch=%o, version=%s',
            id ?? Number.NaN,
            student,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundException(`Es gibt kein Student mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        student.version = { increment: 1 };
        let studentUpdated: StudentUpdated | undefined;
        await this.#prisma.$transaction(async (tx) => {
            studentUpdated = await tx.student.update({
                data: student,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: studentUpdated=%s',
            JSON.stringify(studentUpdated),
        );

        return studentUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Buch wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Buches
     * @returns true, falls das Buch vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const buch = await this.#prisma.student.findUnique({
            where: { id },
        });
        if (buch === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await this.#prisma.$transaction(async (tx) => {
            await tx.student.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    async #validateCreate({
        matriculationNumber,
    }: Prisma.StudentCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: matrnr=%s', matriculationNumber ?? 'undefined');
        if (matriculationNumber === undefined) {
            this.#logger.debug('#validateCreate: ok');
            return;
        }

        const anzahl = await this.#prisma.student.count({ where: { matriculationNumber } });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: matrnr existiert: %s', matriculationNumber);
            throw new MatrNrExistsException(matriculationNumber);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!StudentwalletWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidException(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const buchDb = await this.#readService.findById({ id });

        if (version < buchDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedException(version);
        }
    }
}
