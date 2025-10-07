-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- Aufruf:
-- docker compose exec db bash
-- psql --dbname=campus_wallet --username=campus_wallet --file=/sql/create-table.sql

-- text statt varchar(n):
-- "There is no performance difference among these three types, apart from a few extra CPU cycles
-- to check the length when storing into a length-constrained column"
-- ggf. CHECK(char_length(nachname) <= 255)

-- Indexe auflisten:
-- psql --dbname=campus_wallet --username=campus_wallet
--  SELECT   tablename, indexname, indexdef, tablespace
--  FROM     pg_indexes
--  WHERE    schemaname = 'campus_wallet'
--  \q

-- https://www.postgresql.org/docs/current/manage-ag-tablespaces.html
SET default_tablespace = campuswalletspace;

-- https://www.postgresql.org/docs/current/app-psql.html
-- https://www.postgresql.org/docs/current/ddl-schemas.html
-- https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-CREATE
-- "user-private schema" (Default-Schema: public)
CREATE SCHEMA IF NOT EXISTS AUTHORIZATION campus_wallet;

ALTER ROLE campus_wallet SET search_path = 'campus_wallet';
set search_path to 'campus_wallet';

-- https://www.postgresql.org/docs/current/sql-createtype.html
-- https://www.postgresql.org/docs/current/datatype-enum.html
CREATE TYPE transaction_type AS ENUM ('LOAD', 'SPEND', 'REFUND');

-- https://www.postgresql.org/docs/current/sql-createtable.html
-- https://www.postgresql.org/docs/current/datatype.html
CREATE TABLE IF NOT EXISTS student (
                  -- https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS
                  -- impliziter Index fuer Primary Key
                  -- "GENERATED ALWAYS AS IDENTITY" gemaess SQL-Standard
                  -- entspricht SERIAL mit generierter Sequenz student_id_seq
    id                    integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#id-1.5.4.6.6
    version               integer NOT NULL DEFAULT 0,
                  -- impliziter Index als B-Baum durch UNIQUE
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
    matriculation_number  text NOT NULL UNIQUE,
    first_name            text NOT NULL,
    last_name             text NOT NULL,
    email                 text NOT NULL UNIQUE,
    semester              integer NOT NULL CHECK (semester >= 1),
                  -- https://www.postgresql.org/docs/current/datatype-datetime.html
    created_at            timestamp NOT NULL DEFAULT NOW(),
    updated_at            timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet (
    id                    integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    version               integer NOT NULL DEFAULT 0,
    balance               decimal(12,2) NOT NULL DEFAULT 0,
    auto_reload_enabled   boolean NOT NULL DEFAULT FALSE,
    auto_reload_threshold decimal(12,2) NOT NULL DEFAULT 0,
    auto_reload_amount    decimal(12,2) NOT NULL DEFAULT 0,
    last_reloaded         timestamp,
    student_id            integer NOT NULL UNIQUE REFERENCES student ON DELETE CASCADE,
    created_at            timestamp NOT NULL DEFAULT NOW(),
    updated_at            timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction (
    id           integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    amount       decimal(12,2) NOT NULL,
    type         transaction_type NOT NULL,
    reference    text,
    location     text,
    recorded_at  timestamp NOT NULL DEFAULT NOW(),
    student_id   integer NOT NULL REFERENCES student ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS transaction_student_id_idx ON transaction(student_id);
