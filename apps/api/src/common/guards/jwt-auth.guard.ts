import { HttpStatus, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { AppException } from '../errors.js';

/** Global guard: requires an access token except on @Public() endpoints. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  /** Missing, expired, tampered or revoked token: the same 401, without details. */
  override handleRequest<T>(error: unknown, user: T | false): T {
    if (error || !user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Your session is not valid or has expired',
      );
    }
    return user;
  }
}
