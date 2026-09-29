import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('login')
  login(@Req() req: Request, @Res() res: Response) {
    if (req.session?.user) {
      return res.redirect('/');
    }
    return res.render('login', {
      title: '登录',
      error: null,
      active: 'login',
    });
  }

  @Public()
  @Post('login')
  doLogin(
    @Body('username') username: string,
    @Body('password') password: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = this.authService.validate(
        String(username || ''),
        String(password || ''),
      );
      req.session.user = user;
      return res.redirect('/');
    } catch {
      return res.status(401).render('login', {
        title: '登录',
        error: '用户名或密码错误',
        active: 'login',
      });
    }
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  }
}
