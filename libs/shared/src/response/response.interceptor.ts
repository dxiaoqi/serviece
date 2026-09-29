import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from './api-response';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof ApiResponse) {
          return data;
        }
        if (data && typeof data === 'object' && 'code' in data && 'message' in data && 'data' in data) {
          return data as ApiResponse<T>;
        }
        return ApiResponse.success(data);
      }),
    );
  }
}
