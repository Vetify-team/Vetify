import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { tokenPayloadSchema, type TokenPayload } from '@vetify/types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Entorno } from '../configuracion.js';

/** Valida el access token (Bearer) y deja su payload en `request.user`. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Entorno, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  validate(payload: unknown): TokenPayload {
    const resultado = tokenPayloadSchema.safeParse(payload);
    if (!resultado.success) throw new UnauthorizedException('Token inválido');
    return resultado.data;
  }
}
