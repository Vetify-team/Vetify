import {
  CallHandler,
  ExecutionContext,
  Injectable,
  SetMetadata,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TokenPayload } from '@vetify/types';
import { from, type Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service.js';

const CLAVE_ACCION = 'vetify:accion-bitacora';

/** Nombra la acción que queda en la bitácora; sin él se usa "MÉTODO ruta". */
export const AccionBitacora = (accion: string) =>
  SetMetadata(CLAVE_ACCION, accion);

/**
 * Registra en `bitacora_accesos` todo acceso al expediente de una mascota.
 * Es un interceptor global y no una llamada manual a propósito: cualquier
 * ruta con `:mascotaId` queda registrada sin que nadie tenga que acordarse.
 *
 * Solo escribe cuando el handler terminó bien, es decir, cuando el servicio
 * ya autorizó el acceso. La respuesta no sale hasta que la entrada se guardó.
 */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(
    contexto: ExecutionContext,
    siguiente: CallHandler,
  ): Observable<unknown> {
    const peticion = contexto.switchToHttp().getRequest<{
      params?: Record<string, string>;
      method: string;
      route?: { path?: string };
      user?: TokenPayload;
    }>();

    const mascotaId = peticion.params?.mascotaId;
    if (!mascotaId) return siguiente.handle();

    const accion =
      this.reflector.get<string>(CLAVE_ACCION, contexto.getHandler()) ??
      `${peticion.method} ${peticion.route?.path ?? ''}`.trim();

    return siguiente.handle().pipe(
      concatMap((respuesta) =>
        from(
          this.prisma.bitacoraAcceso
            .create({
              data: {
                mascotaId,
                usuarioId: peticion.user?.sub ?? null,
                accion,
              },
            })
            .then(() => respuesta),
        ),
      ),
    );
  }
}
