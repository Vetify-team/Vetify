import { SetMetadata } from '@nestjs/common';

export const CLAVE_PUBLICO = 'vetify:publico';

/** Marca un endpoint como accesible sin access token (p. ej. /verificar/:token). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
