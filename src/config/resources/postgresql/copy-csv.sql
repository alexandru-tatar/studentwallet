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
-- psql --dbname=campus_wallet --username=postgres --file=/sql/copy-csv.sql

SET search_path TO campus_wallet;

-- https://www.postgresql.org/docs/current/sql-copy.html
COPY student FROM '/csv/students.csv' (FORMAT csv, DELIMITER ';', HEADER true, NULL '\N');
COPY wallet FROM '/csv/wallets.csv' (FORMAT csv, DELIMITER ';', HEADER true, NULL '\N');
COPY transaction FROM '/csv/transactions.csv' (FORMAT csv, DELIMITER ';', HEADER true, NULL '\N');

SELECT setval(
    pg_get_serial_sequence('campus_wallet.student', 'id'),
    COALESCE((SELECT MAX(id) FROM campus_wallet.student), 0) + 1,
    false
);

SELECT setval(
    pg_get_serial_sequence('campus_wallet.wallet', 'id'),
    COALESCE((SELECT MAX(id) FROM campus_wallet.wallet), 0) + 1,
    false
);

SELECT setval(
    pg_get_serial_sequence('campus_wallet.transaction', 'id'),
    COALESCE((SELECT MAX(id) FROM campus_wallet."transaction"), 0) + 1,
    false
);