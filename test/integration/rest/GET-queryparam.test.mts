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
import { describe, expect, test } from 'vitest';
import { Student } from '../../../src/generated/prisma/client.js';
import { type Page } from '../../../src/studentwallet/controller/page.js';
import { StudentMitWallet } from '../../../src/studentwallet/service/studentwallet-service.js';
import { CONTENT_TYPE, restURL } from '../constants.mjs';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const firstNameTeilstuecke = ['lex', 'an', 'se'];
const firstNameNichtVorhanden = ['xxx', 'yyy', 'zzz'];

const lastNameTeilstuecke = ['ta', 'co', 'ka'];
const lastNameNichtVorhanden = ['qqq', 'rrr', 'sss'];

const matriculationNumbers = ['85635', '85625'];
const emails = ['taal1014@stud.hs-ka.de'];

const semesterExact = [1, 3];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest', () => {
  test.concurrent('Alle Studenten', async () => {
    // given

    // when
    const response = await fetch(restURL);
    const { status, headers } = response;

    // then
    expect(status).toBe(HttpStatus.OK);
    expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

    const body = (await response.json()) as Page<Student>;

    body.content
      .map((student) => student.id)
      .forEach((id) => {
        expect(id).toBeDefined();
      });
  });

  // ---- firstName enthält Teilstring -------------------------------------------------
  test.concurrent.each(firstNameTeilstuecke)(
    'Studenten mit Teil-FirstName %s suchen',
    async (firstName) => {
      // given
      const params = new URLSearchParams({ firstName });
      const url = `${restURL}?${params}`;

      // when
      const response = await fetch(url);
      const { status, headers } = response;

      // then
      expect(status).toBe(HttpStatus.OK);
      expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

      const body = (await response.json()) as Page<StudentMitWallet>;
      expect(body).toBeDefined();

      // Jeder Treffer hat firstName mit Teilstring
      body.content
        .map((s) => s.firstName)
        .forEach((fn) =>
          expect(fn?.toLowerCase()).toStrictEqual(expect.stringContaining(firstName)),
        );
    },
  );

  test.concurrent.each(firstNameNichtVorhanden)(
    'Studenten zu nicht vorhandenem Teil-FirstName %s suchen',
    async (firstName) => {
      // given
      const params = new URLSearchParams({ firstName });
      const url = `${restURL}?${params}`;

      // when
      const { status } = await fetch(url);

      // then
      expect(status).toBe(HttpStatus.NOT_FOUND);
    },
  );

  // ---- lastName enthält Teilstring --------------------------------------------------
  test.concurrent.each(lastNameTeilstuecke)(
    'Studenten mit Teil-LastName %s suchen',
    async (lastName) => {
      // given
      const params = new URLSearchParams({ lastName });
      const url = `${restURL}?${params}`;

      // when
      const response = await fetch(url);
      const { status, headers } = response;

      // then
      expect(status).toBe(HttpStatus.OK);
      expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

      const body = (await response.json()) as Page<StudentMitWallet>;
      expect(body).toBeDefined();

      body.content
        .map((s) => s.lastName)
        .forEach((ln) =>
          expect(ln?.toLowerCase()).toStrictEqual(expect.stringContaining(lastName)),
        );
    },
  );

  test.concurrent.each(lastNameNichtVorhanden)(
    'Studenten zu nicht vorhandenem Teil-LastName %s suchen',
    async (lastName) => {
      // given
      const params = new URLSearchParams({ lastName });
      const url = `${restURL}?${params}`;

      // when
      const { status } = await fetch(url);

      // then
      expect(status).toBe(HttpStatus.NOT_FOUND);
    },
  );

  // ---- exakte Suche: matriculationNumber -------------------------------------------
  test.concurrent.each(matriculationNumbers)(
    'Student mit Matrikelnummer %s suchen',
    async (matriculationNumber) => {
      // given
      const params = new URLSearchParams({ matriculationNumber });
      const url = `${restURL}?${params}`;

      // when
      const response = await fetch(url);
      const { status, headers } = response;

      // then
      expect(status).toBe(HttpStatus.OK);
      expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

      const body = (await response.json()) as Page<Student>;

      // 1 Student mit der Matrikelnummer
      expect(body).toBeDefined();
      const studenten = body.content;
      expect(studenten).toHaveLength(1);

      const [student] = studenten;
      const matrNrFound = student?.matriculationNumber;
      expect(matrNrFound).toBe(matriculationNumber);
    },
  );

  // ---- exakte Suche: email ----------------------------------------------------------
  test.concurrent.each(emails)(
    'Student mit Email %s suchen',
    async (email) => {
      // given
      const params = new URLSearchParams({ email });
      const url = `${restURL}?${params}`;

      // when
      const response = await fetch(url);
      const { status, headers } = response;

      // then
      expect(status).toBe(HttpStatus.OK);
      expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

      const body = (await response.json()) as Page<Student>;
      expect(body).toBeDefined();

      const studenten = body.content;
      expect(studenten).toHaveLength(1);

      const [student] = studenten;
      expect(student?.email).toBe(email);
    },
  );

  // ---- exakte Suche: semester -------------------------------------------------------
  test.concurrent.each(semesterExact)(
    'Studenten mit Semester = %i suchen',
    async (semester) => {
      // given
      const params = new URLSearchParams({ semester: semester.toString() });
      const url = `${restURL}?${params}`;

      // when
      const response = await fetch(url);
      const { status, headers } = response;

      // then
      expect(status).toBe(HttpStatus.OK);
      expect(headers.get(CONTENT_TYPE)).toMatch(/json/iu);

      const body = (await response.json()) as Page<Student>;
      body.content
        .map((s) => s.semester)
        .forEach((sem) => expect(sem).toBe(semester));
    },
  );

  // ---- ungültiger Query-Parameter ---------------------------------------------------
  test.concurrent('Keine Studenten zu einer nicht-vorhandenen Property', async () => {
    // given
    const params = new URLSearchParams({ foo: 'bar' });
    const url = `${restURL}?${params}`;

    // when
    const { status } = await fetch(url);

    // then
    expect(status).toBe(HttpStatus.NOT_FOUND);
  });
});