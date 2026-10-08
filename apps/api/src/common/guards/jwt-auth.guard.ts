import {
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLAVE_PUBLICO } from '../decorators/publico.decorator.js';

/** Guard global: exige access token salvo en los endpoints marcados @Publico(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(contexto: ExecutionContext) {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    return esPublico ? true : super.canActivate(contexto);
  }

  /** Token ausente, vencido o alterado: mismo 401 en español, sin detalles. */
  override handleRequest<T>(error: unknown, usuario: T | false): T {
    if (error || !usuario)
      throw new UnauthorizedException('Tu sesión no es válida o expiró');
    return usuario;
  }
}
