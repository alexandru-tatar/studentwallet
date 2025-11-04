import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { type TransactionType } from '../../generated/prisma/enums.js';
import { type StudentWhereInput } from '../../generated/prisma/models/Student.js';
import { getLogger } from '../../logger/logger.js';
import { type Suchparameter } from './suchparameter.js';

/**
 * Hilfsobjekt zum Erzeugen der WHERE-Klausel für Prisma.
 */
@Injectable()
export class WhereBuilder {
    readonly #logger = getLogger(WhereBuilder.name);

    build({
        id,
        matriculationNumber,
        firstName,
        lastName,
        email,
        semester,
        art,
    }: Suchparameter): StudentWhereInput {
        this.#logger.debug(
            'build: id=%s, matriculationNumber=%s, firstName=%s, lastName=%s, email=%s, semester=%s, art=%s',
            id ?? 'undefined',
            matriculationNumber ?? 'undefined',
            firstName ?? 'undefined',
            lastName ?? 'undefined',
            email ?? 'undefined',
            semester ?? 'undefined',
            art ?? 'undefined',
        );

        const where: StudentWhereInput = {};

        const idNumber = this.#toInt(id);
        if (idNumber !== undefined) {
            where.id = { equals: idNumber };
        }

        if (matriculationNumber !== undefined) {
            where.matriculationNumber = {
                contains: matriculationNumber.toString(),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (firstName !== undefined) {
            where.firstName = {
                contains: firstName.toString(),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (lastName !== undefined) {
            where.lastName = {
                contains: lastName.toString(),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (email !== undefined) {
            where.email = {
                contains: email.toString(),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        const semesterNumber = this.#toInt(semester);
        if (semesterNumber !== undefined) {
            where.semester = { equals: semesterNumber };
        }

        if (art !== undefined) {
            const transactionType = art as TransactionType;
            where.transactions = {
                some: {
                    type: {
                        equals: transactionType,
                    },
                },
            };
        }

        this.#logger.debug('build: where=%o', where);
        return where;
    }

    #toInt(value: string | number | undefined): number | undefined {
        if (value === undefined) {
            return undefined;
        }
        const parsed =
            typeof value === 'number' ? value : Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) {
            return undefined;
        }
        return parsed;
    }
}
