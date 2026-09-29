import { Endpoint } from './catalog.types';

export const SERVICE_TITLE = '接口服务';
export const SERVICE_VERSION = '1.3.0';

export const ENDPOINTS: Endpoint[] = [
  {
    id: 'auth-register',
    group: '认证服务',
    method: 'POST',
    path: '/api/auth/register',
    summary: '用户注册',
    description: '创建新用户，成功后直接返回 JWT 令牌，无需再调用登录。',
    auth: 'public',
    body: {
      required: true,
      schema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: '用户名，3–32 字符，仅允许字母、数字、下划线。',
            example: 'alice',
          },
          email: {
            type: 'string',
            format: 'email',
            description: '合法邮箱地址。',
            example: 'alice@example.com',
          },
          password: {
            type: 'string',
            description: '密码，至少 6 位。',
            example: 'secret123',
          },
        },
      },
    },
    data: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT 令牌，有效期 7 天。' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
  },
  {
    id: 'auth-login',
    group: '认证服务',
    method: 'POST',
    path: '/api/auth/login',
    summary: '用户登录',
    description: '校验用户名与密码，成功后返回 JWT 令牌。',
    auth: 'public',
    body: {
      required: true,
      schema: {
        type: 'object',
        properties: {
          username: { type: 'string', description: '用户名。', example: 'alice' },
          password: { type: 'string', description: '密码。', example: 'secret123' },
        },
      },
    },
    data: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT 令牌，有效期 7 天。' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
  },
  {
    id: 'auth-profile',
    group: '认证服务',
    method: 'GET',
    path: '/api/auth/profile',
    summary: '获取当前登录用户',
    description: '根据请求头中的 JWT 返回当前用户信息。',
    auth: 'bearer',
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  {
    id: 'stats-track',
    group: '统计服务',
    method: 'POST',
    path: '/api/stats/downloads/track',
    summary: '上报一次下载',
    description: '记录一次下载事件，服务端自动补充来源 IP 与 User-Agent。',
    auth: 'public',
    body: {
      required: true,
      schema: {
        type: 'object',
        properties: {
          appKey: {
            type: 'string',
            description: '应用标识，仅允许字母、数字、下划线、中划线、点，长度 ≤ 64。',
            example: 'my-app',
          },
          platform: {
            type: 'string',
            nullable: true,
            description: '平台，长度 ≤ 16，缺省为 unknown。',
            example: 'mac',
          },
          version: {
            type: 'string',
            nullable: true,
            description: '版本号，长度 ≤ 32。',
            example: '1.0.0',
          },
        },
      },
    },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        appKey: { type: 'string' },
        platform: { type: 'string' },
        version: { type: 'string', nullable: true },
        ip: { type: 'string', nullable: true },
        userAgent: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  {
    id: 'stats-count',
    group: '统计服务',
    method: 'GET',
    path: '/api/stats/downloads/count',
    summary: '下载总量',
    description: '按条件统计下载总数。',
    auth: 'public',
    queryParams: [
      {
        name: 'appKey',
        required: false,
        description: '按应用标识过滤。',
        schema: { type: 'string' },
        example: 'my-app',
      },
      {
        name: 'startDate',
        required: false,
        description: '起始日期（含），格式 YYYY-MM-DD。',
        schema: { type: 'string', format: 'date' },
        example: '2026-09-01',
      },
      {
        name: 'endDate',
        required: false,
        description: '结束日期（含），格式 YYYY-MM-DD。',
        schema: { type: 'string', format: 'date' },
        example: '2026-09-29',
      },
    ],
    data: {
      type: 'object',
      properties: {
        total: { type: 'integer', description: '下载总数。', example: 1024 },
      },
    },
  },
  {
    id: 'stats-trend',
    group: '统计服务',
    method: 'GET',
    path: '/api/stats/downloads/trend',
    summary: '按日下载趋势',
    description: '返回最近 N 天每天的下载量，无数据的日期补 0。',
    auth: 'public',
    queryParams: [
      {
        name: 'appKey',
        required: false,
        description: '按应用标识过滤。',
        schema: { type: 'string' },
        example: 'my-app',
      },
      {
        name: 'days',
        required: false,
        description: '天数，1–90，默认 7。',
        schema: { type: 'integer' },
        example: '7',
      },
    ],
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          count: { type: 'integer' },
        },
      },
    },
  },
  {
    id: 'stats-ranking',
    group: '统计服务',
    method: 'GET',
    path: '/api/stats/downloads/ranking',
    summary: '应用下载排行',
    description: '按 appKey 聚合的下载量排行。',
    auth: 'public',
    queryParams: [
      {
        name: 'limit',
        required: false,
        description: '返回条数，1–100，默认 10。',
        schema: { type: 'integer' },
        example: '10',
      },
    ],
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          appKey: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
  },
  {
    id: 'stats-platforms',
    group: '统计服务',
    method: 'GET',
    path: '/api/stats/downloads/platforms',
    summary: '平台分布',
    description: '按平台聚合的下载量分布。',
    auth: 'public',
    queryParams: [
      {
        name: 'appKey',
        required: false,
        description: '按应用标识过滤。',
        schema: { type: 'string' },
        example: 'my-app',
      },
    ],
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
  },
];
