import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type {
  IniciarSesion,
  RegistrarUsuario,
  Sesion,
  TokenPayload,
  Usuario,
} from '@vetify/types';
import * as argon2 from 'argon2';
import type { Entorno } from '../configuracion.js';
import { aFechaHora, aRol, desdeRol } from '../common/mapeo.js';
import {
  Prisma,
  type Usuario as UsuarioDb,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface PayloadRefresco {
  sub: string;
  /** id de la fila en `sesiones_refresco` */
  sid: string;
}

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';
const SESION_INVALIDA = 'La sesión expiró. Iniciá sesión de nuevo.';

/** El refresh token ya es aleatorio y firmado: basta un hash rápido para no guardarlo en claro. */
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const aUsuario = (usuario: UsuarioDb): Usuario => ({
  id: usuario.id,
  correo: usuario.correo,
  nombre: usuario.nombre,
  rol: aRol(usuario.rol),
  telefono: usuario.telefono,
  creadoEn: aFechaHora(usuario.creadoEn),
});

/**
 * Registro, login, refresco rotado de sesión y hash de contraseñas con argon2.
 *
 * El refresh token es un JWT con el id de su sesión. Se guarda solo su hash y
 * cada refresco revoca la sesión usada y emite una nueva. Si llega un token de
 * una sesión ya revocada, alguien lo reutilizó: se revocan todas las del usuario.
 */
@Injectable()
export class AuthService {
  /** Hash de relleno para que un correo inexistente tarde lo mismo que uno real. */
  private hashDeRelleno?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Entorno, true>,
  ) {}

  async registrar(datos: RegistrarUsuario): Promise<Sesion> {
    const contrasenaHash = await argon2.hash(datos.contrasena);

    try {
      const usuario = await this.prisma.$transaction(async (tx) => {
        const creado = await tx.usuario.create({
          data: {
            correo: datos.correo.toLowerCase(),
            nombre: datos.nombre,
            telefono: datos.telefono ?? null,
            rol: desdeRol(datos.rol),
            contrasenaHash,
          },
        });

        if (datos.rol === 'clinica' && datos.nombreClinica) {
          await tx.clinica.create({
            data: {
              nombre: datos.nombreClinica,
              personal: {
                create: { usuarioId: creado.id, cargo: 'administrador' },
              },
            },
          });
        }

        return creado;
      });

      return this.emitirSesion(usuario);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }
  }

  async iniciarSesion(datos: IniciarSesion): Promise<Sesion> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: datos.correo.toLowerCase() },
    });

    this.hashDeRelleno ??= argon2.hash('contrasena-de-relleno');
    const hash = usuario?.contrasenaHash ?? (await this.hashDeRelleno);
    const valida = await argon2.verify(hash, datos.contrasena);

    if (!usuario || !valida)
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);

    return this.emitirSesion(usuario);
  }

  async refrescar(refreshToken: string): Promise<Sesion> {
    const sesion = await this.validarRefresco(refreshToken);

    if (sesion.revocadoEn) {
      // Reutilización de un token ya rotado: se cortan todas las sesiones.
      await this.prisma.sesionRefresco.updateMany({
        where: { usuarioId: sesion.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    // Revocación condicional: si dos refrescos llegan a la vez, solo uno gana.
    const { count } = await this.prisma.sesionRefresco.updateMany({
      where: { id: sesion.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    if (count === 0) throw new UnauthorizedException(SESION_INVALIDA);

    return this.emitirSesion(sesion.usuario);
  }

  /** Revoca la sesión de este dispositivo. Un token ya inválido no es error. */
  async cerrarSesion(usuarioId: string, refreshToken: string): Promise<void> {
    try {
      const sesion = await this.validarRefresco(refreshToken);
      if (sesion.usuarioId !== usuarioId) return;
      await this.prisma.sesionRefresco.updateMany({
        where: { id: sesion.id, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
    }
  }

  async usuarioActual(usuarioId: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new UnauthorizedException(SESION_INVALIDA);
    return aUsuario(usuario);
  }

  private async validarRefresco(refreshToken: string) {
    let payload: PayloadRefresco;
    try {
      payload = await this.jwt.verifyAsync<PayloadRefresco>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    const sesion = await this.prisma.sesionRefresco.findUnique({
      where: { id: payload.sid },
      include: { usuario: true },
    });

    const recibido = Buffer.from(hashToken(refreshToken));
    const coincide =
      !!sesion &&
      sesion.tokenHash.length === recibido.length &&
      timingSafeEqual(Buffer.from(sesion.tokenHash), recibido);

    if (!sesion || !coincide || sesion.expiraEn < new Date()) {
      throw new UnauthorizedException(SESION_INVALIDA);
    }

    return sesion;
  }

  private async emitirSesion(usuario: UsuarioDb): Promise<Sesion> {
    const payload: TokenPayload = {
      sub: usuario.id,
      correo: usuario.correo,
      rol: aRol(usuario.rol),
    };
    const sid = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', {
          infer: true,
        }) as JwtSignOptions['expiresIn'],
      }),
      this.jwt.signAsync({ sub: usuario.id, sid } satisfies PayloadRefresco, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', {
          infer: true,
        }) as JwtSignOptions['expiresIn'],
      }),
    ]);

    const { exp } = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.sesionRefresco.create({
      data: {
        id: sid,
        usuarioId: usuario.id,
        tokenHash: hashToken(refreshToken),
        expiraEn: new Date(exp * 1000),
      },
    });

    return { accessToken, refreshToken, usuario: aUsuario(usuario) };
  }
}
