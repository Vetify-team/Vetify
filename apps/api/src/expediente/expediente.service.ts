import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  Aviso,
  Consulta,
  CrearConsulta,
  CrearDesparasitacion,
  CrearExamen,
  CrearRegistroAlimentacion,
  CrearRegistroPeso,
  CrearTratamiento,
  CrearVacuna,
  Desparasitacion,
  EstadoVacunacion,
  Examen,
  Expediente,
  RegistroAlimentacion,
  RegistroPeso,
  TokenPayload,
  Tratamiento,
  Vacuna,
} from '@vetify/types';
import {
  aFecha,
  aFechaHora,
  aFechaOpcional,
  desdeFecha,
  desdeFechaOpcional,
} from '../common/mapeo.js';
import type {
  Mascota as MascotaDb,
  Consulta as ConsultaDb,
  Desparasitacion as DesparasitacionDb,
  Examen as ExamenDb,
  RegistroAlimentacion as RegistroAlimentacionDb,
  RegistroPeso as RegistroPesoDb,
  Tratamiento as TratamientoDb,
  Vacuna as VacunaDb,
} from '../generated/prisma/client.js';
import { PermisosService } from '../permisos/permisos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  avisosDeMascota,
  ordenarAvisos,
  calcularEstadoVacunacion,
  calcularVencimiento,
  normalizarVacuna,
} from './vacunacion.js';

/**
 * País del esquema de vacunación. La mascota todavía no guarda país propio y
 * el piloto es en Costa Rica (Región Brunca).
 */
const PAIS_DEL_ESQUEMA = 'CR';

const aConsulta = (c: ConsultaDb): Consulta => ({
  id: c.id,
  mascotaId: c.mascotaId,
  clinicaId: c.clinicaId,
  veterinarioId: c.veterinarioId,
  fecha: aFechaHora(c.fecha),
  motivo: c.motivo,
  diagnostico: c.diagnostico,
  notas: c.notas,
});

const aVacuna = (v: VacunaDb): Vacuna => ({
  id: v.id,
  mascotaId: v.mascotaId,
  tipo: v.tipo,
  lote: v.lote,
  fechaAplicacion: aFecha(v.fechaAplicacion),
  fechaVencimiento: aFechaOpcional(v.fechaVencimiento),
  clinicaId: v.clinicaId,
});

const aDesparasitacion = (d: DesparasitacionDb): Desparasitacion => ({
  id: d.id,
  mascotaId: d.mascotaId,
  producto: d.producto,
  tipo: d.tipo,
  fecha: aFecha(d.fecha),
  proximaFecha: aFechaOpcional(d.proximaFecha),
});

const aTratamiento = (t: TratamientoDb): Tratamiento => ({
  id: t.id,
  consultaId: t.consultaId,
  mascotaId: t.mascotaId,
  descripcion: t.descripcion,
  inicio: aFechaOpcional(t.inicio),
  fin: aFechaOpcional(t.fin),
});

const aExamen = (e: ExamenDb): Examen => ({
  id: e.id,
  mascotaId: e.mascotaId,
  tipo: e.tipo,
  fecha: aFecha(e.fecha),
  archivoUrl: e.archivoUrl,
  resultado: e.resultado,
});

const aRegistroPeso = (r: RegistroPesoDb): RegistroPeso => ({
  id: r.id,
  mascotaId: r.mascotaId,
  fecha: aFecha(r.fecha),
  pesoKg: r.pesoKg.toNumber(),
});

const aRegistroAlimentacion = (
  r: RegistroAlimentacionDb,
): RegistroAlimentacion => ({
  id: r.id,
  mascotaId: r.mascotaId,
  fecha: aFecha(r.fecha),
  detalle: r.detalle,
});

/** Hoy a medianoche UTC, para comparar contra columnas `date`. */
/**
 * Hoy en Costa Rica, a medianoche UTC para comparar contra columnas `date`.
 * No se usa la fecha UTC: después de las 6 p. m. en Costa Rica ya sería mañana.
 */
const fechaDeHoy = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica',
});
const hoyUtc = (): Date => desdeFecha(fechaDeHoy.format(new Date()));

/**
 * Consultas, vacunas, desparasitaciones, tratamientos, exámenes, peso y alimentación.
 *
 * Regla del producto: el acto médico lo escribe la clínica con permiso activo;
 * el día a día lo escribe el dueño; ambos leen. Cada método empieza por
 * `PermisosService.autorizar`, y la bitácora la escribe el interceptor global.
 */
@Injectable()
export class ExpedienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  async obtener(usuario: TokenPayload, mascotaId: string): Promise<Expediente> {
    await this.permisos.autorizar(usuario, mascotaId, 'leer');

    const mascota = await this.prisma.mascota.findUniqueOrThrow({
      where: { id: mascotaId },
      include: {
        consultas: { orderBy: { fecha: 'desc' } },
        vacunas: { orderBy: { fechaAplicacion: 'desc' } },
        desparasitaciones: { orderBy: { fecha: 'desc' } },
        tratamientos: { orderBy: { inicio: 'desc' } },
        examenes: { orderBy: { fecha: 'desc' } },
        registrosPeso: { orderBy: { fecha: 'asc' } },
        registrosAlimentacion: { orderBy: { fecha: 'desc' } },
      },
    });

    // Nombres de las clínicas y veterinarios que aparecen en el historial.
    const idsClinicas = [
      ...new Set(
        [...mascota.consultas, ...mascota.vacunas]
          .map((r) => r.clinicaId)
          .filter((id): id is string => !!id),
      ),
    ];
    const idsVeterinarios = [
      ...new Set(
        mascota.consultas
          .map((c) => c.veterinarioId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [clinicas, veterinarios] = await Promise.all([
      this.prisma.clinica.findMany({
        where: { id: { in: idsClinicas } },
        select: { id: true, nombre: true },
      }),
      this.prisma.usuario.findMany({
        where: { id: { in: idsVeterinarios } },
        select: { id: true, nombre: true },
      }),
    ]);

    return {
      clinicas,
      veterinarios,
      consultas: mascota.consultas.map(aConsulta),
      vacunas: mascota.vacunas.map(aVacuna),
      desparasitaciones: mascota.desparasitaciones.map(aDesparasitacion),
      tratamientos: mascota.tratamientos.map(aTratamiento),
      examenes: mascota.examenes.map(aExamen),
      registrosPeso: mascota.registrosPeso.map(aRegistroPeso),
      registrosAlimentacion: mascota.registrosAlimentacion.map(
        aRegistroAlimentacion,
      ),
    };
  }

  async estadoVacunacion(
    usuario: TokenPayload,
    mascotaId: string,
  ): Promise<EstadoVacunacion> {
    const { mascota } = await this.permisos.autorizar(
      usuario,
      mascotaId,
      'leer',
    );
    const estados = await this.calcularEstados([mascota]);
    return estados.get(mascota.id)!;
  }

  /**
   * Próximas dosis y dosis atrasadas de todas las mascotas visibles para el
   * usuario. Para una clínica, cada paciente consultado queda en la bitácora:
   * ver su esquema es acceder a su expediente.
   */
  async avisos(usuario: TokenPayload): Promise<Aviso[]> {
    const mascotas = await this.prisma.mascota.findMany({
      where: this.permisos.mascotasVisibles(usuario),
    });
    const estados = await this.calcularEstados(mascotas);

    if (usuario.rol === 'clinica' && mascotas.length) {
      await this.prisma.bitacoraAcceso.createMany({
        data: mascotas.map((m) => ({
          mascotaId: m.id,
          usuarioId: usuario.sub,
          accion: 'ver_avisos',
        })),
      });
    }

    return ordenarAvisos(
      mascotas.flatMap((m) => avisosDeMascota(m, estados.get(m.id)!)),
    );
  }

  /** Estado de vacunación y desparasitación de varias mascotas en pocas consultas. */
  private async calcularEstados(
    mascotas: MascotaDb[],
  ): Promise<Map<string, EstadoVacunacion>> {
    const ids = mascotas.map((m) => m.id);
    const especies = [...new Set(mascotas.map((m) => m.especie))];
    const [esquema, vacunas, desparasitaciones] = await Promise.all([
      this.prisma.esquemaVacunacion.findMany({
        where: { pais: PAIS_DEL_ESQUEMA, especie: { in: especies } },
        orderBy: { edadMinimaMeses: 'asc' },
      }),
      this.prisma.vacuna.findMany({ where: { mascotaId: { in: ids } } }),
      this.prisma.desparasitacion.findMany({
        where: { mascotaId: { in: ids } },
      }),
    ]);
    const hoy = hoyUtc();

    return new Map(
      mascotas.map((m) => [
        m.id,
        calcularEstadoVacunacion({
          pais: PAIS_DEL_ESQUEMA,
          especie: m.especie,
          esquema: esquema.filter((r) => r.especie === m.especie),
          aplicadas: vacunas.filter((v) => v.mascotaId === m.id),
          desparasitaciones: desparasitaciones.filter(
            (d) => d.mascotaId === m.id,
          ),
          fechaNacimiento: m.fechaNacimiento,
          hoy,
        }),
      ]),
    );
  }

  // ---------- Acto médico (clínica con permiso activo) ----------

  async registrarConsulta(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearConsulta,
  ): Promise<Consulta> {
    const { clinicaId } = await this.permisos.autorizar(
      usuario,
      mascotaId,
      'acto_medico',
    );
    const consulta = await this.prisma.consulta.create({
      data: {
        mascotaId,
        clinicaId,
        veterinarioId: usuario.sub,
        fecha: datos.fecha ? new Date(datos.fecha) : undefined,
        motivo: datos.motivo ?? null,
        diagnostico: datos.diagnostico ?? null,
        notas: datos.notas ?? null,
      },
    });
    return aConsulta(consulta);
  }

  /**
   * Si la clínica no indica vencimiento, se calcula con la vigencia del
   * esquema. Con vencimiento conocido se agenda el recordatorio del refuerzo.
   */
  async registrarVacuna(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearVacuna,
  ): Promise<Vacuna> {
    const { mascota, clinicaId } = await this.permisos.autorizar(
      usuario,
      mascotaId,
      'acto_medico',
    );

    const reglas = await this.prisma.esquemaVacunacion.findMany({
      where: { pais: PAIS_DEL_ESQUEMA, especie: mascota.especie },
    });
    const regla = reglas.find(
      (r) => normalizarVacuna(r.vacuna) === normalizarVacuna(datos.tipo),
    );

    const fechaAplicacion = desdeFecha(datos.fechaAplicacion);
    const fechaVencimiento = calcularVencimiento(
      {
        tipo: datos.tipo,
        fechaAplicacion,
        fechaVencimiento: desdeFechaOpcional(datos.fechaVencimiento) ?? null,
      },
      regla,
    );
    if (fechaVencimiento && fechaVencimiento < fechaAplicacion) {
      throw new BadRequestException(
        'El vencimiento no puede ser anterior a la aplicación',
      );
    }

    const vacuna = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.vacuna.create({
        data: {
          mascotaId,
          clinicaId,
          tipo: regla?.vacuna ?? datos.tipo,
          lote: datos.lote ?? null,
          fechaAplicacion,
          fechaVencimiento,
        },
      });
      if (fechaVencimiento) {
        await tx.recordatorio.create({
          data: { mascotaId, tipo: 'vacuna', fechaObjetivo: fechaVencimiento },
        });
      }
      return creada;
    });

    return aVacuna(vacuna);
  }

  async registrarDesparasitacion(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearDesparasitacion,
  ): Promise<Desparasitacion> {
    await this.permisos.autorizar(usuario, mascotaId, 'acto_medico');
    const proximaFecha = desdeFechaOpcional(datos.proximaFecha) ?? null;

    const desparasitacion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.desparasitacion.create({
        data: {
          mascotaId,
          producto: datos.producto ?? null,
          tipo: datos.tipo ?? null,
          fecha: desdeFecha(datos.fecha),
          proximaFecha,
        },
      });
      if (proximaFecha) {
        await tx.recordatorio.create({
          data: {
            mascotaId,
            tipo: 'desparasitacion',
            fechaObjetivo: proximaFecha,
          },
        });
      }
      return creada;
    });

    return aDesparasitacion(desparasitacion);
  }

  async registrarTratamiento(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearTratamiento,
  ): Promise<Tratamiento> {
    await this.permisos.autorizar(usuario, mascotaId, 'acto_medico');

    if (datos.consultaId) {
      const consulta = await this.prisma.consulta.findFirst({
        where: { id: datos.consultaId, mascotaId },
      });
      if (!consulta)
        throw new BadRequestException(
          'La consulta no pertenece a esta mascota',
        );
    }

    const tratamiento = await this.prisma.tratamiento.create({
      data: {
        mascotaId,
        consultaId: datos.consultaId ?? null,
        descripcion: datos.descripcion,
        inicio: desdeFechaOpcional(datos.inicio) ?? null,
        fin: desdeFechaOpcional(datos.fin) ?? null,
      },
    });
    return aTratamiento(tratamiento);
  }

  async registrarExamen(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearExamen,
  ): Promise<Examen> {
    await this.permisos.autorizar(usuario, mascotaId, 'acto_medico');
    const examen = await this.prisma.examen.create({
      data: {
        mascotaId,
        tipo: datos.tipo ?? null,
        fecha: desdeFecha(datos.fecha),
        archivoUrl: datos.archivoUrl ?? null,
        resultado: datos.resultado ?? null,
      },
    });
    return aExamen(examen);
  }

  // ---------- Día a día (dueño) ----------

  async registrarPeso(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearRegistroPeso,
  ): Promise<RegistroPeso> {
    await this.permisos.autorizar(usuario, mascotaId, 'dia_a_dia');
    const registro = await this.prisma.registroPeso.create({
      data: {
        mascotaId,
        pesoKg: datos.pesoKg,
        fecha: desdeFechaOpcional(datos.fecha) ?? hoyUtc(),
      },
    });
    return aRegistroPeso(registro);
  }

  async registrarAlimentacion(
    usuario: TokenPayload,
    mascotaId: string,
    datos: CrearRegistroAlimentacion,
  ): Promise<RegistroAlimentacion> {
    await this.permisos.autorizar(usuario, mascotaId, 'dia_a_dia');
    const registro = await this.prisma.registroAlimentacion.create({
      data: {
        mascotaId,
        detalle: datos.detalle ?? null,
        fecha: desdeFechaOpcional(datos.fecha) ?? hoyUtc(),
      },
    });
    return aRegistroAlimentacion(registro);
  }
}
