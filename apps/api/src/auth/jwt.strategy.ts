import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { tokenPayloadSchema, type TokenPayload } from '@vetify/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_AUDIENCE, ALGORITHM, ISSUER } from './tokens.js';

/**
 * Validates the Bearer access token and leaves its payload on `request.user`.
 * Besides the signature, the session it belongs to must still be active:
 * logging out, rotating or detecting reuse invalidates the access token at
 * once instead of when it expires.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    });
  }

  async validate(payload: unknown): Promise<TokenPayload> {
    const result = tokenPayloadSchema.safeParse(payload);
    if (!result.success) throw new UnauthorizedException();

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: result.data.sid },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.userId !== result.data.sub ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException();
    }
    return result.data;
  }
}
