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
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { HttpStatus } from '@nestjs/common';
import { beforeAll, describe, expect, test } from 'vitest';
import { type StudentDTO } from '../../../src/studentwallet/controller/student-dto.js';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuerStudent: Omit<StudentDTO, 'wallet' | 'transactions'> & {
  wallet: {
    balance: number;
    autoReloadEnabled?: boolean;
    autoReloadThreshold?: number;
    autoReloadAmount?: number;
    lastReloaded?: string;
  };
  transactions: Array<{
    amount: number;
    type: 'LOAD' | 'SPEND' | 'REFUND';
    reference?: string | null;
    location?: string | null;
    recordedAt?: string;
  }>;
} = {
  matriculationNumber: 'MPOST1', // Regex: Großbuchstaben/Ziffern, 5-20
  firstName: 'Max',
  lastName: 'Mustermann',
  email: 'max.post1@stud.hs-karlsruhe.de',
  semester: 3,
  wallet: {
    balance: 25.5,
    autoReloadEnabled: false,
    autoReloadThreshold: 5,
    autoReloadAmount: 10,
    lastReloaded: '2025-01-15T10:30:00.000Z',
  },
  transactions: [
    {
      amount: 3.5,
      type: 'SPEND',
      reference: 'Mensa A - Mittagessen',
      location: 'Mensa/SelfService',
      recordedAt: '2025-02-10T12:15:00.000Z',
    },
  ],
};

const neuerStudentInvalid: Record<string, unknown> = {
  // verletzt mehrere Rules in StudentDtoOhneRef
  matriculationNumber: 'abc',              // Regex verletzt
  firstName: 123,                          // IsString verletzt
  lastName: true,                          // IsString verletzt
  email: 'not-an-email',                   // IsEmail verletzt
  semester: 0,                             // Min(1) verletzt
  // Wallet: verletzt Decimal-Min und ISO
  wallet: {
    balance: -1,                           // >= 0 gefordert
    autoReloadThreshold: -5,
    autoReloadAmount: -10,
    lastReloaded: '12345-99-99',           // ungültiges Datum
  },
  // Transaction: verletzt Amount > 0 und Enum/type
  transactions: [
    {
      amount: 0,                           // > 0 gefordert
      type: 'UNKNOWN',                     // ungültig
      reference: 42,                       // IsString verletzt
      location: 77,                        // IsString verletzt
      recordedAt: 'foo',                   // ISO verletzt
    },
  ],
};

const neuerStudentKonflikt: typeof neuerStudent = {
  // Bitte hier Matrikelnummer/E-Mail verwenden, die in deinen Seeds existieren,
  // damit 422 wirklich ausgelöst wird.
  matriculationNumber: 'M12345',
  firstName: 'Eva',
  lastName: 'Dup',
  email: 'max.mustermann@stud.hs-karlsruhe.de',
  semester: 2,
  wallet: {
    balance: 10,
    autoReloadEnabled: false,
  },
  transactions: [],
};

type MessageType = { message: string | string[] };

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('POST /rest', () => {
  let token: string;

  beforeAll(async () => {
    token = await getToken('admin', 'p');
  });

  test('Neuen Student anlegen', async () => {
    // given
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudent),
      headers,
    });

    // then
    const { status } = response;
    expect(status).toBe(HttpStatus.CREATED);

    const responseHeaders = response.headers;
    const location = responseHeaders.get(LOCATION);
    expect(location).toBeDefined();

    // ID nach dem letzten "/"
    const indexLastSlash = location?.lastIndexOf('/') ?? -1;
    expect(indexLastSlash).not.toBe(-1);

    const idStr = location?.slice(indexLastSlash + 1);
    expect(idStr).toBeDefined();

    const idNum = Number(idStr);
    expect(Number.isFinite(idNum)).toBe(true);
    expect(idNum).toBeGreaterThan(0);
  });

  test.concurrent('Neuer Student mit ungueltigen Daten', async () => {
    // given
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // erwartete Feldprefixe wie bei den Buch-Tests
    const expectedMsg = [
    expect.stringMatching(/^matriculationNumber /u),
    expect.stringMatching(/^firstName /u),
    expect.stringMatching(/^lastName /u),
    expect.stringMatching(/^email /u),
    expect.stringMatching(/^semester /u),
    expect.stringMatching(/^wallet\.balance /u),
    expect.stringMatching(/^wallet\.autoReloadThreshold /u),
    expect.stringMatching(/^wallet\.autoReloadAmount /u),
    expect.stringMatching(/^wallet\.lastReloaded /u),
    expect.stringMatching(/^transactions\[0\]\.amount /u),
    expect.stringMatching(/^transactions\[0\]\.type /u),
    expect.stringMatching(/^transactions\[0\]\.reference /u),
    expect.stringMatching(/^transactions\[0\]\.location /u),
    expect.stringMatching(/^transactions\[0\]\.recordedAt /u),
    ];

    // when
    const response = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudentInvalid),
      headers,
    });

    // then
    const { status } = response;
    expect(status).toBe(HttpStatus.BAD_REQUEST);

    const body = (await response.json()) as MessageType;
    const messages = Array.isArray(body.message) ? body.message : [body.message];

    expect(messages).toBeDefined();
    // Mindestens die o.g. Fehler; je nach Validatoren können es mehr sein
    expect(messages.length).toBeGreaterThanOrEqual(expectedMsg.length);
    expect(messages).toStrictEqual(expect.arrayContaining(expectedMsg));
  });

  test.concurrent('Neuer Student, aber Matrikel/E-Mail existiert bereits', async () => {
    // given
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudentKonflikt),
      headers,
    });

    // then
    const { status } = response;
    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

    const body = (await response.json()) as MessageType;
    // Meldung kann je nach Service "matriculationNumber" oder "email" enthalten
    expect(
      Array.isArray(body.message)
        ? body.message.join(' ')
        : body.message,
    ).toMatch(/(matriculationNumber|email)/u);
  });

  test.concurrent('Neuer Student, aber ohne Token', async () => {
    // when
    const { status } = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudent),
    });

    // then
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });

  test.concurrent('Neuer Student, aber mit falschem Token', async () => {
    // given
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

    // when
    const { status } = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudent),
      headers,
    });

    // then
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });

  test.concurrent.todo('Abgelaufener Token');
});