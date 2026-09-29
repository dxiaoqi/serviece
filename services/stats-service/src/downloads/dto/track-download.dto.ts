import { IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class TrackDownloadDto {
  @IsNotEmpty({ message: 'appKey 不能为空' })
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_\-\.]+$/, {
    message: 'appKey 只能包含字母、数字、下划线、中划线和点',
  })
  appKey: string;

  @IsOptional()
  @MaxLength(16)
  platform?: string;

  @IsOptional()
  @MaxLength(32)
  version?: string;
}
