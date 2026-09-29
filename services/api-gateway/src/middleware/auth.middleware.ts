import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { ApiResponse, JwtPayload } from '@app/shared';

const PUBLIC_PATHS: Array<{ method: string; prefix: string }> = [
  { method: 'POST', prefix: '/api/auth/register' },
  { method: 'POST', prefix: '/api/auth/login' },
  { method: 'GET', prefix: '/api/stats/' },
  { method: 'POST', prefix: '/api/stats/downloads/track' },
];

function isPublic(method: string, path: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => p.method === method && path.startsWith(p.prefix),
  );
}

@Injectable()
export class GatewayAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!req.path.startsWith('/api/') || isPublic(req.method, req.path)) {
      next();
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json(ApiResponse.error(40100, '缺少登录令牌'));
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      const secret = process.env.JWT_SECRET ?? 'dev-secret';
      const payload = jwt.verify(token, secret) as JwtPayload;
      (req as Request & { user?: JwtPayload }).user = payload;
      next();
    } catch {
      res.status(401).json(ApiResponse.error(40100, '登录令牌无效或已过期'));
    }
  }
}
