import { Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';

export interface DatabaseInfo {
  name: string;
  owner: string;
  size: number;
}

export interface TableInfo {
  name: string;
  type: string;
  rows: number;
  size: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimary: boolean;
}

@Injectable()
export class DatabaseService {
  private readonly host = process.env.DB_HOST || 'postgres';
  private readonly port = Number(process.env.DB_PORT || 5432);
  private readonly user =
    process.env.POSTGRES_READONLY_USER || 'readonly_user';
  private readonly password =
    process.env.POSTGRES_READONLY_PASSWORD || 'readonly_pass';

  private pools = new Map<string, Pool>();

  private poolFor(database: string): Pool {
    let pool = this.pools.get(database);
    if (!pool) {
      pool = new Pool({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database,
        max: 5,
      });
      this.pools.set(database, pool);
    }
    return pool;
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    const pool = this.poolFor('postgres');
    const result = await pool.query(
      `SELECT d.datname AS name,
              pg_catalog.pg_get_userbyid(d.datdba) AS owner,
              pg_catalog.pg_database_size(d.datname) AS size
         FROM pg_catalog.pg_database d
        WHERE d.datistemplate = false
        ORDER BY d.datname`,
    );
    return result.rows;
  }

  async listTables(database: string): Promise<TableInfo[]> {
    const pool = this.poolFor(database);
    const result = await pool.query(
      `SELECT c.relname AS name,
              CASE c.relkind WHEN 'r' THEN '普通表' WHEN 'v' THEN '视图' ELSE c.relkind::text END AS type,
              c.reltuples::bigint AS rows,
              pg_catalog.pg_total_relation_size(c.oid) AS size
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'v')
        ORDER BY c.relname`,
    );
    return result.rows;
  }

  async describeTable(
    database: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    const pool = this.poolFor(database);
    const result = await pool.query(
      `SELECT a.attname AS name,
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
              a.attnotnull AS nullable,
              pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default,
              CASE WHEN pk.contype = 'p' THEN true ELSE false END AS "isPrimary"
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
         LEFT JOIN pg_catalog.pg_constraint pk
                ON pk.conrelid = c.oid AND a.attnum = ANY (pk.conkey) AND pk.contype = 'p'
        WHERE n.nspname = 'public'
          AND c.relname = $1
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum`,
      [table],
    );
    return result.rows.map((r) => ({
      ...r,
      nullable: !r.nullable,
    }));
  }

  async countRows(database: string, table: string): Promise<number> {
    const pool = this.poolFor(database);
    const result = await pool.query(
      `SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(table)}`,
    );
    return Number(result.rows[0].count);
  }

  async getRows(
    database: string,
    table: string,
    limit: number,
    offset: number,
  ): Promise<{ columns: string[]; rows: any[][] }> {
    const pool = this.poolFor(database);
    const result: QueryResult = await pool.query(
      `SELECT * FROM ${quoteIdent(table)} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows.map((r) => result.fields.map((f) => r[f.name])),
    };
  }

  async runQuery(
    database: string,
    sql: string,
  ): Promise<{ columns: string[]; rows: any[][]; rowCount: number }> {
    const pool = this.poolFor(database);
    const result = await pool.query(sql);
    const columns = result.fields
      ? result.fields.map((f) => f.name)
      : [];
    return {
      columns,
      rows: result.fields
        ? result.rows.map((r) => result.fields.map((f) => r[f.name]))
        : [],
      rowCount: result.rowCount || 0,
    };
  }
}

function quoteIdent(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('非法标识符');
  }
  return `"${value}"`;
}
