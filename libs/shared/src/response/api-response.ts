export class ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;

  static success<T>(data: T, message = 'success'): ApiResponse<T> {
    const res = new ApiResponse<T>();
    res.code = 0;
    res.message = message;
    res.data = data;
    return res;
  }

  static error(code: number, message: string): ApiResponse<null> {
    const res = new ApiResponse<null>();
    res.code = code;
    res.message = message;
    res.data = null;
    return res;
  }
}
