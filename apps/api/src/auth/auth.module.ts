import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PasswordResetService } from './password-reset.service.js';
import { FilesModule } from '../files/files.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  // Access and refresh tokens use different secrets and audiences, so they
  // are passed on every sign/verify instead of a module-wide configuration.
  imports: [PassportModule, JwtModule.register({}), MailModule, FilesModule],
  controllers: [AuthController],
  providers: [AccountService, AuthService, JwtStrategy, PasswordResetService],
})
export class AuthModule {}
