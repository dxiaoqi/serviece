import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUploadGrantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  category: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;
}

export class SignedUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  key: string;
}
