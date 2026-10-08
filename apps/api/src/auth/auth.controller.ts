import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
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
  refrescar(
    @Body(new ZodValidationPipe(refrescarSesionSchema)) datos: RefrescarSesion,
  ): Promise<Sesion> {
    return this.authService.refrescar(datos.refreshToken);
  }

  @ApiBearerAuth()
  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalidar el refresh token de este dispositivo' })
  cerrarSesion(
    @UsuarioActual() usuario: TokenPayload,
    @Body(new ZodValidationPipe(cerrarSesionSchema)) datos: CerrarSesion,
  ): Promise<void> {
    return this.authService.cerrarSesion(usuario.sub, datos.refreshToken);
  }

  @ApiBearerAuth()
  @Get('yo')
  @ApiOperation({ summary: 'Datos del usuario autenticado' })
  yo(@UsuarioActual() usuario: TokenPayload): Promise<Usuario> {
    return this.authService.usuarioActual(usuario.sub);
  }
}
