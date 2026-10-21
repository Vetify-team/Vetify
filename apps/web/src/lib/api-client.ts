import type {
  ActualizarMascota,
  Aviso,
  CerrarSesion,
  CuerpoDeError,
  Clinica,
  Consulta,
  CrearConsulta,
  CrearDesparasitacion,
  CrearExamen,
  CrearMascota,
  CrearRegistroAlimentacion,
  CrearRegistroPeso,
  CrearTratamiento,
  CrearVacuna,
  Desparasitacion,
  EntradaBitacora,
  EstadoVacunacion,
  Examen,
  Expediente,
  IniciarSesion,
  Mascota,
  OtorgarPermiso,
  Permiso,
  PermisoConClinica,
  RefrescarSesion,
  RegistrarUsuario,
  RegistroAlimentacion,
  RegistroPeso,
  Sesion,
  Tratamiento,
  Usuario,
  Vacuna,
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
    readonly errores?: CuerpoDeError["errores"],
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
    let errores: CuerpoDeError["errores"];

    try {
      // El API siempre responde con la forma de CuerpoDeError (ver su filtro de excepciones).
      const cuerpo = (await respuesta.json()) as Partial<CuerpoDeError>;
      mensaje = cuerpo.mensaje ?? mensaje;
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
    const refreshToken = this.sesion?.refreshToken;
    try {
      if (refreshToken) {
        await this.peticion<void>("/auth/cerrar-sesion", {
          method: "POST",
          cuerpo: { refreshToken } satisfies CerrarSesion,
        });
      }
    } finally {
      this.almacen.guardar(null);
    }
  }

  yo(): Promise<Usuario> {
    return this.peticion("/auth/yo");
  }

  // ---------- Mascotas ----------

  /** Del dueño: sus mascotas. De la clínica: pacientes con permiso activo. */
  mascotas(): Promise<Mascota[]> {
    return this.peticion("/mascotas");
  }

  mascota(id: string): Promise<Mascota> {
    return this.peticion(`/mascotas/${id}`);
  }

  crearMascota(datos: CrearMascota): Promise<Mascota> {
    return this.peticion("/mascotas", { method: "POST", cuerpo: datos });
  }

  actualizarMascota(id: string, datos: ActualizarMascota): Promise<Mascota> {
    return this.peticion(`/mascotas/${id}`, { method: "PATCH", cuerpo: datos });
  }

  // ---------- Expediente ----------

  expediente(mascotaId: string): Promise<Expediente> {
    return this.peticion(`/mascotas/${mascotaId}/expediente`);
  }

  vacunacion(mascotaId: string): Promise<EstadoVacunacion> {
    return this.peticion(`/mascotas/${mascotaId}/vacunacion`);
  }

  /** Dosis atrasadas y próximas de todas las mascotas visibles. */
  avisos(): Promise<Aviso[]> {
    return this.peticion("/avisos");
  }

  registrarConsulta(mascotaId: string, datos: CrearConsulta): Promise<Consulta> {
    return this.peticion(`/mascotas/${mascotaId}/consultas`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarVacuna(mascotaId: string, datos: CrearVacuna): Promise<Vacuna> {
    return this.peticion(`/mascotas/${mascotaId}/vacunas`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarDesparasitacion(
    mascotaId: string,
    datos: CrearDesparasitacion,
  ): Promise<Desparasitacion> {
    return this.peticion(`/mascotas/${mascotaId}/desparasitaciones`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarTratamiento(mascotaId: string, datos: CrearTratamiento): Promise<Tratamiento> {
    return this.peticion(`/mascotas/${mascotaId}/tratamientos`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarExamen(mascotaId: string, datos: CrearExamen): Promise<Examen> {
    return this.peticion(`/mascotas/${mascotaId}/examenes`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarPeso(mascotaId: string, datos: CrearRegistroPeso): Promise<RegistroPeso> {
    return this.peticion(`/mascotas/${mascotaId}/peso`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  registrarAlimentacion(
    mascotaId: string,
    datos: CrearRegistroAlimentacion,
  ): Promise<RegistroAlimentacion> {
    return this.peticion(`/mascotas/${mascotaId}/alimentacion`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  // ---------- Permisos y clínicas ----------

  permisos(mascotaId: string): Promise<PermisoConClinica[]> {
    return this.peticion(`/mascotas/${mascotaId}/permisos`);
  }

  otorgarPermiso(mascotaId: string, datos: OtorgarPermiso): Promise<PermisoConClinica> {
    return this.peticion(`/mascotas/${mascotaId}/permisos`, {
      method: "POST",
      cuerpo: datos,
    });
  }

  revocarPermiso(mascotaId: string, permisoId: string): Promise<Permiso> {
    return this.peticion(`/mascotas/${mascotaId}/permisos/${permisoId}/revocar`, {
      method: "PATCH",
    });
  }

  bitacora(mascotaId: string): Promise<EntradaBitacora[]> {
    return this.peticion(`/mascotas/${mascotaId}/bitacora`);
  }

  buscarClinicas(busqueda: string): Promise<Clinica[]> {
    return this.peticion(`/clinicas?busqueda=${encodeURIComponent(busqueda)}`);
  }

  miClinica(): Promise<Clinica> {
    return this.peticion("/clinicas/mia");
  }
}

export const api = new ClienteApi();
