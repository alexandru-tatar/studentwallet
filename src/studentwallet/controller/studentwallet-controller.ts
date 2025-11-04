import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    UseInterceptors
} from '@nestjs/common';
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { Public } from 'nest-keycloak-connect';
import { paths } from '../../config/paths.js';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.js';
import { createPageable } from '../service/pageable.js';
import {
    type StudentMitWallet,
    StudentMitWalletUndTransaktionen,
    StudentwalletService,
} from '../service/studentwallet-service.js';
import { type Suchparameter } from '../service/suchparameter.js';
import { createPage, Page } from './page.js';


export class StudentWalletSearchQuery implements Suchparameter {
  @ApiProperty({ required: false })
  declare readonly id?: number;

  @ApiProperty({ required: false })
  declare readonly matriculationNumber?: string;

  @ApiProperty({ required: false })
  declare readonly firstName?: string;

  @ApiProperty({ required: false })
  declare readonly lastName?: string;

  @ApiProperty({ required: false })
  declare readonly email?: string;

  @ApiProperty({ required: false })
  declare readonly semester?: number;

  @ApiProperty({ required: false })
  declare readonly only?: 'count';

  @ApiProperty({ required: false })
  declare size?: string;

  @ApiProperty({ required: false })
  declare page?: string;
}

export type CountResult = Record<'count', number>;

@Controller(paths.rest)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Studentwallet REST-API')
export class StudentwalletController {
    readonly #service: StudentwalletService;

    readonly #logger = getLogger(StudentwalletController.name);

    constructor(service: StudentwalletService) {
        this.#service = service;
    }

    @Get(':studentId')
    @Public()
    @ApiOperation({ summary: 'Ermittelt eine Student anhand ihrer ID' })
    @ApiParam({
        name: 'studentId',
        description: 'Student-ID als Integer',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Version für bedingte GET-Requests, z.B. "3"',
        required: false,
    })
    @ApiOkResponse({ description: 'Die Student wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Keine Student zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Die Student ist unverändert',
    })
    async getById(
        @Param('studentId', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }))
        id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<StudentMitWalletUndTransaktionen>> {
        // https://getpino.io/#/docs/api?id=message-string
        this.#logger.debug('getById: id=%d, version=%s', id, version ?? '-1');

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('getById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const student = await this.#service.findById({ id });
        this.#logger.debug('getById(): buch=%o', student);

        // ETags
        const versionDb = student.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('getById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('getById: versionDb=%d', versionDb ?? -1);
        res.header('ETag', `"${versionDb}"`);

        this.#logger.debug('getById: buch=%o', student);
        return res.json(student);
    }

    /**
     * Bücher werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Buch gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Büchern, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Buch zu den Suchparameter gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Bücher ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @Public()
    @ApiOperation({ summary: 'Suche mit Suchparameter' })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Studenten' })
    async get(
        @Query() query: StudentWalletSearchQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<Page<Readonly<StudentMitWallet>> | CountResult>> {
        this.#logger.debug('get: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('get: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const { only } = query;
        if (only !== undefined) {
            const count = await this.#service.count();
            this.#logger.debug('get: count=%d', count);
            return res.json({ count: count });
        }

        const { page, size } = query;
        delete query['page'];
        delete query['size'];
        this.#logger.debug(
            'get: page=%s, size=%s',
            page ?? 'undefined',
            size ?? 'undefined',
        );

        const keys = Object.keys(query) as (keyof StudentWalletSearchQuery)[];
        keys.forEach((key) => {
            if (query[key] === undefined) {
                delete query[key];
            }
        });
        this.#logger.debug('get: query=%o', query);

        const pageable = createPageable({ number: page, size });
        const studentenSlice = await this.#service.find(query, pageable); // NOSONAR
        const studentPage = createPage(studentenSlice, pageable);
        this.#logger.debug('get: studentPage=%o', studentPage);

        return res.json(studentPage).send();
    }
}