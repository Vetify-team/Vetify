import type {
  IniciarSesion,
  RefrescarSesion,
  RegistrarUsuario,
  Sesion,
} from "@vetify/types";

/**
 * Cliente HTTP contra el API de NestJS. Es el único punto del frontend que
 * hace `fetch`: ningún componente llama a la red por su cuenta.
 *
 * No importa nada de `next/*` a propósito, para que pueda reutilizarse tal
 * cual desde apps/mobile si algún día se agrega.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly errores?: { campo: string; mensaje: string }[],
  ) {
    super(mensaje);
    this.name = "ErrorDeApi";
  }
}

/** Almacenamiento de la sesión; se inyecta para no atar el cliente al navegador. */
export interface AlmacenDeSesion {
  leer(): Sesion | null;
  guardar(sesion: Sesion | null): void;
}

const CLAVE_SESION = "vetify:sesion";

export const almacenEnNavegador: AlmacenDeSesion = {
  leer() {
    if (typeof window === "undefined") return null;
    try {
      const crudo = window.localStorage.getItem(CLAVE_SESION);
      return crudo ? (JSON.parse(crudo) as Sesion) : null;
    } catch {
      return null;
    }
  },
  guardar(sesion) {
    if (typeof window === "undefined") return;
    try {
      if (sesion) window.localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      else window.localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Modo privado o almacenamiento bloqueado: la sesión dura lo que la pestaña.
    }
  },
};

interface OpcionesPeticion extends Omit<RequestInit, "body"> {
  cuerpo?: unknown;
  /** Endpoints públicos (login, registro, verificación de carné). */
  sinAutenticar?: boolean;
}

export class ClienteApi {
  private refrescoEnCurso: Promise<Sesion | null> | null = null;

  constructor(
    private readonly base: string = BASE,
    private readonly almacen: AlmacenDeSesion = almacenEnNavegador,
  ) {}

  get sesion(): Sesion | null {
    return this.almacen.leer();
  }

  async peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
    const { cuerpo, sinAutenticar, headers, ...resto } = opciones;

    const enviar = async (token?: string): Promise<Response> =>
      fetch(`${this.base}${ruta}`, {
        ...resto,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      });

    let respuesta = await enviar(sinAutenticar ? undefined : this.sesion?.accessToken);

    // Un 401 con sesión guardada casi siempre es el access token vencido:
    // se refresca una sola vez y se reintenta.
    if (respuesta.status === 401 && !sinAutenticar && this.sesion?.refreshToken) {
      const renovada = await this.refrescar();
      if (renovada) respuesta = await enviar(renovada.accessToken);
    }

    if (!respuesta.ok) throw await this.construirError(respuesta);

    return respuesta.status === 204 ? (undefined as T) : ((await respuesta.json()) as T);
  }

  private async construirError(respuesta: Response): Promise<ErrorDeApi> {
    let mensaje = "No pudimos completar la operación. Intentá de nuevo.";
    let errores: { campo: string; mensaje: string }[] | undefined;

    try {
      const cuerpo = (await respuesta.json()) as {
        mensaje?: string;
        message?: string;
        errores?: { campo: string; mensaje: string }[];
      };
      mensaje = cuerpo.mensaje ?? cuerpo.message ?? mensaje;
      errores = cuerpo.errores;
    } catch {
      // Respuesta sin JSON: se queda el mensaje genérico.
    }

    return new ErrorDeApi(respuesta.status, mensaje, errores);
  }

  /** Refresca la sesión. Las llamadas concurrentes comparten la misma promesa. */
  private async refrescar(): Promise<Sesion | null> {
    this.refrescoEnCurso ??= (async () => {
      const refreshToken = this.sesion?.refreshToken;
      if (!refreshToken) return null;

      try {
        const respuesta = await fetch(`${this.base}/auth/refrescar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken } satisfies RefrescarSesion),
        });

        if (!respuesta.ok) {
          this.almacen.guardar(null);
          return null;
        }

        const sesion = (await respuesta.json()) as Sesion;
        this.almacen.guardar(sesion);
        return sesion;
      } finally {
        this.refrescoEnCurso = null;
      }
    })();

    return this.refrescoEnCurso;
  }

  // ---------- Autenticación ----------

  async registrar(datos: RegistrarUsuario): Promise<Sesion> {
    const sesion = await this.peticion<Sesion>("/auth/registrar", {
      method: "POST",
      cuerpo: datos,
      sinAutenticar: true,
    });
    this.almacen.guardar(sesion);
    return sesion;
  }

  async iniciarSesion(datos: IniciarSesion): Promise<Sesion> {
    const sesion = await this.peticion<Sesion>("/auth/iniciar-sesion", {
      method: "POST",
      cuerpo: datos,
      sinAutenticar: true,
    });
    this.almacen.guardar(sesion);
    return sesion;
  }

  async cerrarSesion(): Promise<void> {
    try {
      await this.peticion<void>("/auth/cerrar-sesion", { method: "POST" });
    } finally {
      this.almacen.guardar(null);
    }
  }
}

export const api = new ClienteApi();
