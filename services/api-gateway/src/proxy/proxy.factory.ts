import { createProxyMiddleware } from 'http-proxy-middleware';
import type { RequestHandler } from 'express';

export interface ProxyTarget {
  prefix: string;
  target: string;
}

export function createServiceProxy(prefix: string, target: string): RequestHandler {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 10000,
    timeout: 10000,
    pathFilter: (path) => path.startsWith(prefix),
    on: {
      error: (err, _req, res) => {
        const response = res as import('http').ServerResponse;
        if (response && !response.headersSent && 'writeHead' in response) {
          response.writeHead(503, {
            'Content-Type': 'application/json; charset=utf-8',
          });
          response.end(
            JSON.stringify({
              code: 50300,
              message: `下游服务暂不可用: ${err.message}`,
              data: null,
            }),
          );
        }
      },
    },
  }) as unknown as RequestHandler;
}
