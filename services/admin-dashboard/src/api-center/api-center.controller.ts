import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiCatalogService } from './api-catalog.service';

@Controller('api-center')
export class ApiCenterController {
  constructor(private readonly catalog: ApiCatalogService) {}

  @Get()
  async index(@Req() req: Request, @Res() res: Response) {
    return res.render('api-center/index', {
      title: '接口中心',
      active: 'api-center',
      user: req.session?.user,
      baseUrl: this.catalog.getBaseUrl(),
      endpoints: this.catalog.getEndpoints(),
      aiBrief: this.catalog.buildAiBrief(),
    });
  }

  @Get('openapi.json')
  openapiJson(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="openapi.json"',
    );
    res.send(this.catalog.toJson());
  }

  @Get('openapi.yaml')
  openapiYaml(@Res() res: Response) {
    res.setHeader(
      'Content-Type',
      'application/yaml; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="openapi.yaml"',
    );
    res.send(this.catalog.toYaml());
  }

  @Get('ai-brief.md')
  aiBrief(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="api-brief.md"',
    );
    res.send(this.catalog.buildAiBrief());
  }
}
