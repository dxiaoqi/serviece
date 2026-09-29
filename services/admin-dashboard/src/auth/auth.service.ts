import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly username = process.env.DASHBOARD_USER || 'admin';
  private readonly password = process.env.DASHBOARD_PASSWORD || 'admin123';

  validate(username: string, password: string): { username: string } {
    if (username === this.username && password === this.password) {
      return { username };
    }
    throw new UnauthorizedException('用户名或密码错误');
  }
}
