import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  sesionSchema,
  usuarioSchema,
  cerrarSesionSchema,
  iniciarSesionSchema,
  refrescarSesionSchema,
  registrarUsuarioSchema,
  type CerrarSesion,
  type IniciarSesion,
  type RefrescarSesion,
  type RegistrarUsuario,
  type Sesion,
  type TokenPayload,
  type Usuario,
} from '@vetify/types';
import { Publico } from '../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Cuerpo, Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

/** Límite estricto para frenar fuerza bruta en las rutas de credenciales. */
const LIMITE_CREDENCIALES = { general: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('registrar')
  @ApiOperation({ summary: 'Crear una cuenta de dueño o de clínica' })
  @Cuerpo('RegistrarUsuario', registrarUsuarioSchema)
  @Respuesta('Sesion', sesionSchema, {
    estado: 201,
    descripcion: 'Cuenta creada y sesión iniciada',
  })
  @Errores(400, 409, 429)
  registrar(
    @Body(new ZodValidationPipe(registrarUsuarioSchema))
    datos: RegistrarUsuario,
  ): Promise<Sesion> {
    return this.authService.registrar(datos);
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('iniciar-sesion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  @Cuerpo('IniciarSesion', iniciarSesionSchema)
  @Respuesta('Sesion', sesionSchema)
  @Errores(400, 401, 429)
  iniciarSesion(
    @Body(new ZodValidationPipe(iniciarSesionSchema)) datos: IniciarSesion,
  ): Promise<Sesion> {
    return this.authService.iniciarSesion(datos);
  }

  @Publico()
  @Throttle(LIMITE_CREDENCIALES)
  @Post('refrescar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotar el refresh token y obtener un access token nuevo',
  })
  @Cuerpo('RefrescarSesion', refrescarSesionSchema)
  @Respuesta('Sesion', sesionSchema, {
    descripcion: 'Par de tokens nuevo; el refresh token enviado deja de servir',
  })
  @Errores(400, 401, 429)
  refrescar(
    @Body(new ZodValidationPipe(refrescarSesionSchema)) datos: RefrescarSesion,
  ): Promise<Sesion> {
    return this.authService.refrescar(datos.refreshToken);
  }

  @ApiBearerAuth()
  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidar el refresh token de este dispositivo' })
  @Cuerpo('CerrarSesion', cerrarSesionSchema)
  @ApiNoContentResponse({ description: 'Sesión cerrada en este dispositivo' })
  @Errores(401)
  cerrarSesion(
    @UsuarioActual() usuario: TokenPayload,
    @Body(new ZodValidationPipe(cerrarSesionSchema)) datos: CerrarSesion,
  ): Promise<void> {
    return this.authService.cerrarSesion(usuario.sub, datos.refreshToken);
  }

  @ApiBearerAuth()
  @Get('yo')
  @ApiOperation({ summary: 'Datos del usuario autenticado' })
  @Respuesta('Usuario', usuarioSchema)
  @Errores(401)
  yo(@UsuarioActual() usuario: TokenPayload): Promise<Usuario> {
    return this.authService.usuarioActual(usuario.sub);
  }
}
