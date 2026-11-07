import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  logInSchema,
  sessionSchema,
  signUpSchema,
  userSchema,
  type LogIn,
  type Session,
  type SignUp,
  type TokenPayload,
  type User,
} from '@vetify/types';
import type { Request, Response } from 'express';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { assertAllowedOrigin } from '../common/http/origin.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthService, type IssuedSession } from './auth.service.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './tokens.js';

/**
 * Credential endpoints: 10 per minute per IP and 5 per minute per account
 * (the `account` throttler keys on the email in the body).
 */
const CREDENTIALS_LIMIT = {
  general: { limit: 10, ttl: 60_000 },
  account: { limit: 5, ttl: 60_000 },
};

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(CREDENTIALS_LIMIT)
  @Post('register')
  @ApiOperation({
    summary: 'Create an owner or clinic account and start a session',
  })
  @ZodBody('SignUp', signUpSchema)
  @ZodResponse('Session', sessionSchema, {
    status: 201,
    description:
      'Account created. The refresh token is set in an HttpOnly cookie.',
  })
  @ErrorResponses(400, 403, 409, 415, 429)
  async register(
    @Req() req: Request,
    @Body(new ZodValidationPipe(signUpSchema)) data: SignUp,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.withCookie(res, await this.auth.signUp(data));
  }

  @Public()
  @Throttle(CREDENTIALS_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ZodBody('LogIn', logInSchema)
  @ZodResponse('Session', sessionSchema, {
    description:
      'Session started. The refresh token is set in an HttpOnly cookie.',
  })
  @ErrorResponses(400, 401, 403, 415, 429)
  async login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(logInSchema)) data: LogIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.withCookie(res, await this.auth.logIn(data));
  }

  @Public()
  @Throttle({ general: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: 'Rotate the refresh cookie and get a new access token',
    description:
      'Reads the refresh token from the HttpOnly cookie. Replaying a rotated token revokes every session.',
  })
  @ZodResponse('Session', sessionSchema)
  @ErrorResponses(401, 403, 429)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    try {
      return this.withCookie(
        res,
        await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]),
      );
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({
    summary: "Revoke this device's session and clear the cookie",
  })
  @ApiNoContentResponse({ description: 'Logged out' })
  @ErrorResponses(403)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    await this.auth.logOut(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The authenticated user' })
  @ZodResponse('User', userSchema)
  @ErrorResponses(401)
  me(@CurrentUser() user: TokenPayload): Promise<User> {
    return this.auth.me(user);
  }

  private withCookie(res: Response, issued: IssuedSession): Session {
    res.cookie(REFRESH_COOKIE, issued.refreshToken, {
      ...this.cookieOptions(),
      expires: issued.refreshExpiresAt,
    });
    return issued.session;
  }

  private clearCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict' as const,
      path: REFRESH_COOKIE_PATH,
    };
  }
}
