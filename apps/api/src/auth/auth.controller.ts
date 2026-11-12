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
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  acceptClinicInvitationSchema,
  registerClinicSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  logInSchema,
  resetPasswordSchema,
  sessionSchema,
  signUpSchema,
  userSchema,
  type AcceptClinicInvitation,
  type RegisterClinic,
  type DeleteAccount,
  type ForgotPassword,
  type LogIn,
  type ResetPassword,
  type Session,
  type SignUp,
  type TokenPayload,
  type User,
} from '@vetify/types';
import type { Request, Response } from 'express';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  assertAllowedOrigin,
  requireAllowedOrigin,
  trustedOrigin,
} from '../common/http/origin.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AccountService } from './account.service.js';
import { AuthService, type IssuedSession } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
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
    private readonly passwordReset: PasswordResetService,
    private readonly account: AccountService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(CREDENTIALS_LIMIT)
  @Post('register')
  @ApiOperation({
    summary: 'Create an owner account and start a session',
    description:
      'Owners only. Clinics register with the link an admin issues (POST /auth/clinic-signup).',
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
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinic-signup')
  @ApiOperation({
    summary: "Register a clinic with an admin's single-use link",
    description:
      "Creates the clinic (unverified) and its first administrator, with the link's email; a paid plan of the link starts now.",
  })
  @ZodBody('RegisterClinic', registerClinicSchema)
  @ZodResponse('Session', sessionSchema, {
    status: 201,
    description:
      'Clinic and account created. The refresh token is set in an HttpOnly cookie.',
  })
  @ErrorResponses(400, 403, 409, 415, 429)
  async registerClinic(
    @Req() req: Request,
    @Body(new ZodValidationPipe(registerClinicSchema)) data: RegisterClinic,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    const origin = trustedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.withCookie(res, await this.auth.registerClinic(data, origin));
  }

  @Public()
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinic-invitations/accept')
  @ApiOperation({
    summary: "Accept a clinic team invitation: create the member's account",
    description:
      'The account takes the invited email and role. The invitation is single use and expires.',
  })
  @ZodBody('AcceptClinicInvitation', acceptClinicInvitationSchema)
  @ZodResponse('Session', sessionSchema, {
    status: 201,
    description:
      'Account created and joined to the clinic. The refresh token is set in an HttpOnly cookie.',
  })
  @ErrorResponses(400, 403, 409, 415, 429)
  async acceptInvitation(
    @Req() req: Request,
    @Body(new ZodValidationPipe(acceptClinicInvitationSchema))
    data: AcceptClinicInvitation,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Session> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.withCookie(res, await this.auth.acceptInvitation(data));
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

  /** 5 per minute per IP and 3 per minute per email, on top of a per-account cooldown. */
  @Public()
  @Throttle({
    general: { limit: 5, ttl: 60_000 },
    account: { limit: 3, ttl: 60_000 },
  })
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a password reset link',
    description:
      'Always 202, whether or not the account exists. The link points to the requesting site (its Origin must be allowed) and works once, for a limited time.',
  })
  @ZodBody('ForgotPassword', forgotPasswordSchema)
  @ApiAcceptedResponse({
    description: 'If the account exists, the email is on its way',
  })
  @ErrorResponses(400, 403, 415, 429)
  forgotPassword(
    @Req() req: Request,
    @Body(new ZodValidationPipe(forgotPasswordSchema)) data: ForgotPassword,
  ): void {
    const origin = requireAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    this.passwordReset.request(data.email, origin);
  }

  @Public()
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set a new password with the emailed token',
    description:
      'Spends the link and revokes every session of the account; the user logs in again.',
  })
  @ZodBody('ResetPassword', resetPasswordSchema)
  @ApiNoContentResponse({ description: 'Password changed' })
  @ErrorResponses(400, 403, 415, 429)
  async resetPassword(
    @Req() req: Request,
    @Body(new ZodValidationPipe(resetPasswordSchema)) data: ResetPassword,
  ): Promise<void> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    await this.passwordReset.reset(data.token, data.password);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The authenticated user' })
  @ZodResponse('User', userSchema)
  @ErrorResponses(401)
  me(@CurrentUser() user: TokenPayload): Promise<User> {
    return this.auth.me(user);
  }

  /**
   * 5 per minute per IP and per account (keyed on the token user), so a
   * stolen session cannot guess the password from many IPs.
   */
  @ApiBearerAuth()
  @Roles('owner')
  @Throttle({
    general: { limit: 5, ttl: 60_000 },
    account: { limit: 5, ttl: 60_000 },
  })
  @Post('account/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Close the owner's account and erase their data",
    description:
      'Owners only. Checks the current password, deletes the account with its pets, records, clinic permissions, sessions, notices and payments, emails a confirmation and clears the refresh cookie. A wrong password answers 403 WRONG_PASSWORD.',
  })
  @ZodBody('DeleteAccount', deleteAccountSchema)
  @ApiNoContentResponse({ description: 'Account deleted' })
  @ErrorResponses(400, 401, 403, 429)
  async deleteAccount(
    @Req() req: Request,
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(deleteAccountSchema)) data: DeleteAccount,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    assertAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    await this.account.delete(user, data.password);
    this.clearCookie(res);
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
