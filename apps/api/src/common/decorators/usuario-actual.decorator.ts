import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';

/** Devuelve el payload del access token que dejó la estrategia JWT. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): TokenPayload | undefined => {
    const peticion = contexto.switchToHttp().getRequest<{ user?: TokenPayload }>();
    return peticion.user;
  },
);
