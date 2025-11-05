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
  matriculationNumber: 'MPOST1',
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
  matriculationNumber: 'abc',
  firstName: 123,
  lastName: true,
  email: 'not-an-email',
  semester: 0,
  wallet: {
    balance: -1,
    autoReloadThreshold: -5,
    autoReloadAmount: -10,
    lastReloaded: '12345-99-99',
  },
  transactions: [
    {
      amount: 0,
      type: 'SPEND',
      reference: 42,
      location: 77,
      recordedAt: 'foo',
    },
  ],
};



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

    const expectedMsg = [
      // Wallet
      expect.stringMatching(/^wallet\.balance .*≥ 0\./u),
      expect.stringMatching(/^wallet\.autoReloadThreshold .*≥ 0\./u),
      expect.stringMatching(/^wallet\.autoReloadAmount .*≥ 0\./u),
      expect.stringMatching(/^wallet\.lastReloaded .*ISO 8601/i),

      expect.stringMatching(/^transactions\.0\.amount .*>\s*0/i),
      expect.stringMatching(/^transactions\.0\.reference .*string/i),
      expect.stringMatching(/^transactions\.0\.location .*string/i),
      expect.stringMatching(/^transactions\.0\.recordedAt .*ISO 8601/i),

      expect.stringMatching(/^matriculationNumber: Großbuchstaben\/Ziffern, 5-20 Zeichen$/u),
      expect.stringMatching(/^firstName .*string/i),
      expect.stringMatching(/^lastName .*string/i),
      expect.stringMatching(/^email .*email/i),
      expect.stringMatching(/^semester .*not be less than 1/i),
    ];

    // when
    const response = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(neuerStudentInvalid),
      headers,
    });

    // then
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);

    const body = (await response.json()) as { message: string[] | string };
    const messages = Array.isArray(body.message) ? body.message : [body.message];

    expect(messages).toBeDefined();

    expect(messages).toEqual(expect.arrayContaining(expectedMsg));
    expect(messages).toHaveLength(expectedMsg.length);
  });

  test.concurrent('Neuer Student, aber Matrikel/E-Mail existiert bereits', async () => {
    // given
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    const suffix = Date.now().toString();
    const dup = {
      matriculationNumber: `DUP${suffix}`,
      firstName: 'Eva',
      lastName: 'Dup',
      email: `dup${suffix}@stud.hs-karlsruhe.de`,
      semester: 2,
      wallet: { balance: 0, autoReloadEnabled: false },
      transactions: [],
    };

    const r1 = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(dup),
      headers,
    });
    expect(r1.status).toBe(HttpStatus.CREATED);

    const r2 = await fetch(restURL, {
      method: POST,
      body: JSON.stringify(dup),
      headers,
    });
    expect(r2.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);

    const body = (await r2.json()) as { message: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(' ') : body.message;

    expect(msg).toMatch(
      /(Matrikel|Matrikel-Nummer|E[- ]?Mail|existiert bereits|matriculation|email|exists)/iu,
    );
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
});