import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    const token = this.authService.login(dto.login, dto.password);
    if (!token) {
      throw new UnauthorizedException('Invalid login or password');
    }

    return token;
  }
}
