import { Injectable } from '@nestjs/common';
import { stringify as toYaml } from 'yaml';
import { ENDPOINTS, SERVICE_TITLE, SERVICE_VERSION } from './catalog';
import { Endpoint, FieldSchema } from './catalog.types';

interface JsonSchema {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  nullable?: boolean;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

@Injectable()
export class ApiCatalogService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3005';
  }

  getEndpoints(): Endpoint[] {
    return ENDPOINTS;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  buildOpenApi(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const ep of ENDPOINTS) {
      const operation: Record<string, unknown> = {
        tags: [ep.group],
        summary: ep.summary,
        operationId: ep.id,
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'integer', example: 0, description: '业务状态码，0 表示成功。' },
                    message: { type: 'string', example: 'success' },
                    data: this.toJsonSchema(ep.data),
                  },
                  required: ['code', 'message', 'data'],
                },
              },
            },
          },
          '401': {
            description: '未授权（需要登录或令牌无效）',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          default: {
            description: '其他错误',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      };

      if (ep.description) {
        operation.description = ep.description;
      }
      if (ep.auth === 'bearer') {
        operation.security = [{ bearerAuth: [] }];
      }
      if (ep.queryParams?.length) {
        operation.parameters = ep.queryParams.map((p) => ({
          name: p.name,
          in: 'query',
          required: Boolean(p.required),
          description: p.description,
          schema: this.toJsonSchema(p.schema),
          ...(p.example !== undefined ? { example: p.example } : {}),
        }));
      }
      if (ep.body) {
        operation.requestBody = {
          required: Boolean(ep.body.required),
          content: {
            'application/json': {
              schema: this.toJsonSchema(ep.body.schema),
            },
          },
        };
      }

      if (!paths[ep.path]) {
        paths[ep.path] = {};
      }
      paths[ep.path][ep.method.toLowerCase()] = operation;
    }

    return {
      openapi: '3.0.3',
      info: {
        title: SERVICE_TITLE,
        version: SERVICE_VERSION,
        description:
          '通过运维管理台导出的接口契约。所有响应均为统一包裹结构 { code, message, data }，code=0 表示成功。',
      },
      servers: [{ url: this.baseUrl, description: '统一网关地址' }],
      tags: [
        { name: '认证服务', description: '注册、登录、当前用户' },
        { name: '统计服务', description: '下载量上报与统计' },
      ],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: '在 Authorization 头中携带：Bearer <token>。',
          },
        },
        schemas: {
          ErrorResponse: {
            type: 'object',
            properties: {
              code: { type: 'integer', example: 40100 },
              message: { type: 'string', example: '登录令牌无效或已过期' },
              data: { type: 'object', nullable: true, example: null },
            },
            required: ['code', 'message', 'data'],
          },
        },
      },
    };
  }

  toJsonSchema(field: FieldSchema): JsonSchema {
    const schema: JsonSchema = { type: field.type };
    if (field.format) {
      schema.format = field.format;
    }
    if (field.description) {
      schema.description = field.description;
    }
    if (field.example !== undefined) {
      schema.example = field.example;
    }
    if (field.nullable) {
      schema.nullable = true;
    }
    if (field.type === 'array' && field.items) {
      schema.items = this.toJsonSchema(field.items);
    }
    if (field.type === 'object' && field.properties) {
      const required: string[] = [];
      const properties: Record<string, JsonSchema> = {};
      for (const [key, value] of Object.entries(field.properties)) {
        properties[key] = this.toJsonSchema(value);
        if (!value.nullable) {
          required.push(key);
        }
      }
      schema.properties = properties;
      if (required.length) {
        schema.required = required;
      }
      schema.additionalProperties = false;
    }
    return schema;
  }

  toJson(): string {
    return JSON.stringify(this.buildOpenApi(), null, 2);
  }

  toYaml(): string {
    return toYaml(this.buildOpenApi(), { lineWidth: 0 });
  }

  buildAiBrief(): string {
    const lines: string[] = [];
    lines.push(`# ${SERVICE_TITLE} - 前端接入说明（供 AI 使用）`);
    lines.push('');
    lines.push(`- 网关基址 Base URL：\`${this.baseUrl}\``);
    lines.push('- 所有接口返回统一 JSON 结构：`{ "code": 0, "message": "success", "data": ... }`');
    lines.push('- 判断成功：`code === 0`；失败时读取 `message` 展示错误，`data` 为 `null`。');
    lines.push('- 需要鉴权的接口在请求头携带：`Authorization: Bearer <token>`，token 由注册/登录接口返回，有效期 7 天。');
    lines.push('- 请求体均为 `application/json`；查询参数直接拼在 URL 上。');
    lines.push('- 已开启 CORS，允许浏览器跨域调用。');
    lines.push('');

    const groups = Array.from(new Set(ENDPOINTS.map((e) => e.group)));
    for (const group of groups) {
      lines.push(`## ${group}`);
      lines.push('');
      for (const ep of ENDPOINTS.filter((e) => e.group === group)) {
        lines.push(`### ${ep.method} ${ep.path}`);
        lines.push(`- 说明：${ep.summary}${ep.description ? `。${ep.description}` : ''}`);
        lines.push(`- 鉴权：${ep.auth === 'bearer' ? '需要 Bearer Token' : '公开，无需登录'}`);
        if (ep.body) {
          lines.push(`- 请求体字段：${this.describeFields(ep.body.schema)}`);
        }
        if (ep.queryParams?.length) {
          const q = ep.queryParams
            .map((p) => `\`${p.name}\`（${p.required ? '必填' : '可选'}${p.description ? '，' + p.description : ''}）`)
            .join('、');
          lines.push(`- 查询参数：${q}`);
        }
        lines.push(`- data 返回：${this.describeFields(ep.data)}`);
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  private describeFields(field: FieldSchema): string {
    if (field.type === 'object' && field.properties) {
      const parts = Object.entries(field.properties).map(([key, value]) => {
        const t =
          value.type === 'object' && value.properties
            ? `{ ${Object.keys(value.properties).join(', ')} }`
            : value.type === 'array' && value.items
              ? `${this.describeFields(value.items)}[]`
              : value.type;
        return `${key}: ${t}`;
      });
      return `{ ${parts.join('; ')} }`;
    }
    if (field.type === 'array' && field.items) {
      return `${this.describeFields(field.items)}[]`;
    }
    return field.type;
  }
}
