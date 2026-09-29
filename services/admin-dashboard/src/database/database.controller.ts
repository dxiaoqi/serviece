import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from './database.service';

const PAGE_SIZE = 50;

@Controller('databases')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async listDatabases(@Req() req: Request, @Res() res: Response) {
    const databases = await this.databaseService.listDatabases();
    return res.render('db/databases', {
      title: '数据库',
      active: 'database',
      user: req.session?.user,
      databases,
      bytes,
    });
  }

  @Get(':db/tables')
  async listTables(
    @Param('db') db: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tables = await this.databaseService.listTables(db);
    return res.render('db/tables', {
      title: `${db} / 数据表`,
      active: 'database',
      user: req.session?.user,
      db,
      tables,
      bytes,
    });
  }

  @Get(':db/tables/:table')
  async showTable(
    @Param('db') db: string,
    @Param('table') table: string,
    @Query('page') page: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const [columnsInfo, total, data] = await Promise.all([
      this.databaseService.describeTable(db, table),
      this.databaseService.countRows(db, table),
      this.databaseService.getRows(
        db,
        table,
        PAGE_SIZE,
        (currentPage - 1) * PAGE_SIZE,
      ),
    ]);
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    return res.render('db/table', {
      title: `${db} / ${table}`,
      active: 'database',
      user: req.session?.user,
      db,
      table,
      columnsInfo,
      data,
      total,
      currentPage,
      totalPages,
    });
  }

  @Get(':db/sql')
  sqlForm(
    @Param('db') db: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return res.render('db/sql', {
      title: `${db} / SQL 查询`,
      active: 'database',
      user: req.session?.user,
      db,
      sql: 'SELECT * FROM users LIMIT 20;',
      result: null,
      error: null,
    });
  }

  @Post(':db/sql')
  async runSql(
    @Param('db') db: string,
    @Body('sql') sql: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const queryText = String(sql || '').trim();
    if (!queryText) {
      throw new BadRequestException('SQL 不能为空');
    }
    try {
      const result = await this.databaseService.runQuery(db, queryText);
      return res.render('db/sql', {
        title: `${db} / SQL 查询`,
        active: 'database',
        user: req.session?.user,
        db,
        sql: queryText,
        result,
        error: null,
      });
    } catch (e) {
      return res.status(400).render('db/sql', {
        title: `${db} / SQL 查询`,
        active: 'database',
        user: req.session?.user,
        db,
        sql: queryText,
        result: null,
        error: e instanceof Error ? e.message : '查询失败',
      });
    }
  }

  @Get(':db/tables/:table/export')
  async exportCsv(
    @Param('db') db: string,
    @Param('table') table: string,
    @Res() res: Response,
  ) {
    const data = await this.databaseService.getRows(db, table, 100000, 0);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${db}_${table}.csv"`,
    );
    res.write('﻿');
    res.write(data.columns.map(csvEscape).join(',') + '\n');
    for (const row of data.rows) {
      res.write(row.map(csvEscape).join(',') + '\n');
    }
    res.end();
  }
}

function bytes(value: number): string {
  if (!value) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(value) / Math.log(1024));
  return `${(value / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
