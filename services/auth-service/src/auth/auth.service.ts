import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '@app/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existsByUsername = await this.usersService.findByUsername(
      dto.username,
    );
    if (existsByUsername) {
      throw new ConflictException('用户名已被注册');
    }

    const existsByEmail = await this.usersService.findByEmail(dto.email);
    if (existsByEmail) {
      throw new ConflictException('邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(
      dto.username,
      dto.email,
      passwordHash,
    );

    return this.buildAuthResult(user.id, user.username, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return this.buildAuthResult(user.id, user.username, user.email);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  private async buildAuthResult(
    sub: string,
    username: string,
    email: string,
  ) {
    const payload: JwtPayload = { sub, username, email };
    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: '7d',
    });
    return {
      token,
      user: { id: sub, username, email },
    };
  }
}
