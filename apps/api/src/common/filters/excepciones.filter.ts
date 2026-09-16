import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

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
      excepcion instanceof HttpException
        ? excepcion.getResponse()
        : { mensaje: 'Ocurrió un error inesperado' };

    if (estado >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(excepcion);
    }

    respuesta.status(estado).json(typeof cuerpo === 'string' ? { mensaje: cuerpo } : cuerpo);
  }
}
