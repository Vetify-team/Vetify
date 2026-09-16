import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida la entrada con un esquema Zod de @vetify/types. El contrato vive en
 * packages/types: aquí solo se aplica, nunca se redefine.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor);

    if (!resultado.success) {
      throw new BadRequestException({
        mensaje: 'Los datos enviados no son válidos',
        errores: resultado.error.issues.map((problema) => ({
          campo: problema.path.join('.'),
          mensaje: problema.message,
        })),
      });
    }

    return resultado.data;
  }
}
