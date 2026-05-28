import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  login(login: string, password: string) {
    const adminLogin = this.config.get<string>('ADMIN_LOGIN', 'admin');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD', 'admin');

    if (login !== adminLogin || password !== adminPassword) {
      return null;
    }

    return {
      accessToken: this.jwt.sign({ sub: adminLogin, login: adminLogin }),
    };
  }
}
