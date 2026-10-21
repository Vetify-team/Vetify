import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { CuerpoDeError } from '@vetify/types';
import type { Response } from 'express';

/**
 * Las excepciones propias ya traen `{ mensaje, errores }`; las de Nest traen
 * `{ message, error, statusCode }`. Todo sale con la forma de `CuerpoDeError`.
 */
const normalizar = (cuerpo: string | object | null): CuerpoDeError => {
  if (typeof cuerpo === 'string') return { mensaje: cuerpo };
  if (!cuerpo) return { mensaje: 'Ocurrió un error inesperado' };
  if ('mensaje' in cuerpo) return cuerpo as CuerpoDeError;
  const { message } = cuerpo as { message?: string | string[] };
  return {
    mensaje: Array.isArray(message)
      ? message.join('. ')
      : (message ?? 'Ocurrió un error'),
  };
};

/** Respuesta de error uniforme y en español para todo el API. */
@Catch()
export class FiltroDeExcepciones implements ExceptionFilter {
  private readonly logger = new Logger(FiltroDeExcepciones.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();

    const estado =
      excepcion instanceof HttpException
        ? excepcion.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const cuerpo =
      excepcion instanceof HttpException ? excepcion.getResponse() : null;

    if (estado >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(excepcion);
    }

    respuesta.status(estado).json(normalizar(cuerpo));
  }
}
