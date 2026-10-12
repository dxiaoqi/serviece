import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public, StorageService } from '@app/shared';
import { CreateUploadGrantDto, SignedUrlDto } from './dto/storage.dto';

@Public()
@Controller('storage')
export class StorageDemoController {
  constructor(private readonly storage: StorageService) {}

  @Get('info')
  info() {
    return { driver: this.storage.driver, enabled: this.storage.enabled };
  }

  @Get('signed-url')
  signedUrl(@Query() query: SignedUrlDto) {
    return this.storage.signedUrl(query.key);
  }

  @Post('upload-grant')
  uploadGrant(@Body() dto: CreateUploadGrantDto) {
    return this.storage.createUploadGrant({
      category: dto.category,
      filename: dto.filename,
      contentType: dto.contentType,
    });
  }
}
