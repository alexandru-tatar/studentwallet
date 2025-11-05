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
import { type StudentDtoOhneRef } from '../../../src/studentwallet/controller/student-dto.js';
import {
  APPLICATION_JSON,
  AUTHORIZATION,
  BEARER,
  CONTENT_TYPE,
  IF_MATCH,
  PUT,
  restURL,
} from '../constants.mjs';
import { getToken } from '../token.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const geaenderterStudent: StudentDtoOhneRef = {
  matriculationNumber: '85625',
  firstName: 'Alexandru',
  lastName: 'Tatar',
  email: 'taal1014@stud.hs-ka.de',
  semester: 2,
};
const idVorhanden = '1000';

const geaenderterStudentIdNichtVorhanden: StudentDtoOhneRef = {
  matriculationNumber: '85625',
  firstName: 'Alice',
  lastName: 'Noexist',
  email: 'alice.noexist@h-ka.de',
  semester: 2,
};
const idNichtVorhanden = '999999';

const geaenderterStudentInvalid: Record<string, unknown> = {
  // verletzt Regex (nur Ziffern, 5 Zeichen)
  matriculationNumber: 'abc',
  // verletzt IsString
  firstName: 123,
  // verletzt IsString
  lastName: true,
  // verletzt IsEmail
  email: 'not-an-email',
  // verletzt Min(1)
  semester: 0,
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('PUT /rest/:id', () => {
  let token: string;

  beforeAll(async () => {
    token = await getToken('admin', 'p');
  });

  test('Vorhandenen Student aendern', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"0"');
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const { status } = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudent),
      headers,
    });

    // then
    expect(status).toBe(HttpStatus.NO_CONTENT);
  });

  test('Nicht-vorhandenen Student aendern', async () => {
    // given
    const url = `${restURL}/${idNichtVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"0"');
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const { status } = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudentIdNichtVorhanden),
      headers,
    });

    // then
    expect(status).toBe(HttpStatus.NOT_FOUND);
  });

  test('Vorhandenen Student aendern, aber mit ungueltigen Daten', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"0"');
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    const expectedMsg = [
      'matriculationNumber: Großbuchstaben/Ziffern, 5-20 Zeichen',
      'firstName must be a string',
      'lastName must be a string',
      'email must be an email',
      'semester must not be less than 1',
    ];

    // when
    const response = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudentInvalid),
      headers,
    });

    // then
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);

    const body = (await response.json()) as { message: string[] };
    const messages = body.message;

    expect(messages).toBeDefined();
    expect(messages).toHaveLength(expectedMsg.length);
    expect(messages).toEqual(expect.arrayContaining(expectedMsg));
  });

  test('Vorhandenen Student aendern, aber ohne Versionsnummer', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudent),
      headers,
    });

    // then
    expect(response.status).toBe(HttpStatus.PRECONDITION_REQUIRED);

    const body = await response.text();
    expect(body).toBe(`Header "${IF_MATCH}" fehlt`);
  });

  test('Vorhandenen Student aendern, aber mit alter Versionsnummer', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"-1"');
    headers.append(AUTHORIZATION, `${BEARER} ${token}`);

    // when
    const response = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudent),
      headers,
    });

    // then
    expect(response.status).toBe(HttpStatus.PRECONDITION_FAILED);

    const { message, statusCode } = (await response.json()) as {
      message: string;
      statusCode: number;
    };

    expect(message).toMatch(/Versionsnummer/u);
    expect(statusCode).toBe(HttpStatus.PRECONDITION_FAILED);
  });

  test('Vorhandenen Student aendern, aber ohne Token', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"0"');

    // when
    const { status } = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudent),
      headers,
    });

    // then
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });

  test('Vorhandenen Student aendern, aber mit falschem Token', async () => {
    // given
    const url = `${restURL}/${idVorhanden}`;
    const headers = new Headers();
    headers.append(CONTENT_TYPE, APPLICATION_JSON);
    headers.append(IF_MATCH, '"0"');
    headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

    // when
    const { status } = await fetch(url, {
      method: PUT,
      body: JSON.stringify(geaenderterStudent),
      headers,
    });

    // then
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });
});