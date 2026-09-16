import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Registra en `bitacora_accesos` todo acceso al expediente de una mascota.
 * Es un interceptor y no una llamada manual a propósito: así no depende de
 * que alguien se acuerde de escribir la bitácora en cada endpoint nuevo.
 *
 * TODO(módulos): inyectar PrismaService y persistir la entrada. El esqueleto
 * deja el punto de enganche; la escritura llega con el módulo de expediente.
 */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const peticion = contexto.switchToHttp().getRequest<{
      params?: Record<string, string>;
      method?: string;
      user?: { sub?: string };
    }>();

    const mascotaId = peticion.params?.mascotaId ?? peticion.params?.id;

    return siguiente.handle().pipe(
      tap(() => {
        if (!mascotaId) return;
        // Punto de enganche de la bitácora; se implementa con el módulo de expediente.
        void mascotaId;
      }),
    );
  }
}
