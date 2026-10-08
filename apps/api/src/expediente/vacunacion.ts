import type {
  Aviso,
  EstadoDesparasitacion,
  EstadoVacuna,
  EstadoVacunacion,
  Especie,
  VacunaDelEsquema,
} from '@vetify/types';
import { aFecha } from '../common/mapeo.js';

/** Días antes del vencimiento a partir de los cuales una vacuna está "por vencer". */
export const DIAS_AVISO_VENCIMIENTO = 30;

const MS_POR_DIA = 86_400_000;

export interface ReglaEsquema {
  vacuna: string;
  edadMinimaMeses: number | null;
  vigenciaMeses: number;
}

export interface DesparasitacionAplicada {
  tipo: string | null;
  producto: string | null;
  fecha: Date;
  proximaFecha: Date | null;
}

export interface VacunaAplicada {
  tipo: string;
  fechaAplicacion: Date;
  fechaVencimiento: Date | null;
}

/** Suma meses en UTC, ajustando al último día si el mes destino es más corto. */
export const sumarMeses = (fecha: Date, meses: number): Date => {
  const resultado = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1),
  );
  const ultimoDia = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(fecha.getUTCDate(), ultimoDia));
  return resultado;
};

/** "Antirrábica" y "antirrabica " son la misma vacuna. */
export const normalizarVacuna = (nombre: string): string =>
  nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/** Estado de algo que vence en `fecha`: ya pasó, está cerca o falta. */
export const estadoPorFecha = (fecha: Date | null, hoy: Date): EstadoVacuna => {
  if (!fecha) return 'vigente';
  const dias = (fecha.getTime() - hoy.getTime()) / MS_POR_DIA;
  if (dias < 0) return 'vencida';
  return dias <= DIAS_AVISO_VENCIMIENTO ? 'por_vencer' : 'vigente';
};

/** Vencimiento explícito si la clínica lo registró; si no, aplicación + vigencia del esquema. */
export const calcularVencimiento = (
  aplicada: VacunaAplicada,
  regla: Pick<ReglaEsquema, 'vigenciaMeses'> | undefined,
): Date | null =>
  aplicada.fechaVencimiento ??
  (regla ? sumarMeses(aplicada.fechaAplicacion, regla.vigenciaMeses) : null);

/**
 * Cruza el esquema preventivo (país + especie) con las vacunas aplicadas y la
 * edad de la mascota. Es el "proceso" central del expediente: de aquí salen el
 * carné, los recordatorios y la cobertura que ve el dueño.
 */
export const calcularEstadoVacunacion = (entrada: {
  pais: string;
  especie: Especie;
  esquema: ReglaEsquema[];
  aplicadas: VacunaAplicada[];
  desparasitaciones?: DesparasitacionAplicada[];
  fechaNacimiento: Date | null;
  hoy: Date;
}): EstadoVacunacion => {
  const { esquema, aplicadas, fechaNacimiento, hoy } = entrada;

  const vacunas = esquema.map((regla): VacunaDelEsquema => {
    const clave = normalizarVacuna(regla.vacuna);
    const ultima = aplicadas
      .filter((aplicada) => normalizarVacuna(aplicada.tipo) === clave)
      .sort(
        (a, b) => b.fechaAplicacion.getTime() - a.fechaAplicacion.getTime(),
      )[0];

    if (ultima) {
      const vencimiento = calcularVencimiento(ultima, regla);
      const estado = estadoPorFecha(vencimiento, hoy);

      return {
        vacuna: regla.vacuna,
        estado,
        ultimaAplicacion: aFecha(ultima.fechaAplicacion),
        fechaVencimiento: vencimiento ? aFecha(vencimiento) : null,
        proximaFecha:
          estado === 'vencida' || !vencimiento ? null : aFecha(vencimiento),
      };
    }

    // Nunca aplicada. Sin fecha de nacimiento se asume que ya le corresponde.
    const edadMinima = regla.edadMinimaMeses ?? 0;
    const disponibleDesde = fechaNacimiento
      ? sumarMeses(fechaNacimiento, edadMinima)
      : null;
    const aunNo = disponibleDesde !== null && disponibleDesde > hoy;

    return {
      vacuna: regla.vacuna,
      estado: aunNo ? 'no_aplica_aun' : 'pendiente',
      ultimaAplicacion: null,
      fechaVencimiento: null,
      proximaFecha: aunNo ? aFecha(disponibleDesde) : null,
    };
  });

  const protegidas = vacunas.filter(
    (v) => v.estado === 'vigente' || v.estado === 'por_vencer',
  );

  return {
    pais: entrada.pais,
    especie: entrada.especie,
    cobertura: vacunas.length
      ? Math.round((protegidas.length / vacunas.length) * 100)
      : 0,
    vacunas,
    desparasitaciones: ultimasDesparasitaciones(
      entrada.desparasitaciones ?? [],
      hoy,
    ),
  };
};

/** La desparasitación más reciente de cada tipo (interna, externa…). */
const ultimasDesparasitaciones = (
  aplicadas: DesparasitacionAplicada[],
  hoy: Date,
): EstadoDesparasitacion[] => {
  const porTipo = new Map<string, DesparasitacionAplicada>();
  for (const d of aplicadas) {
    const clave = normalizarVacuna(d.tipo ?? '');
    const actual = porTipo.get(clave);
    if (!actual || d.fecha > actual.fecha) porTipo.set(clave, d);
  }
  return [...porTipo.values()].map((d) => ({
    tipo: d.tipo,
    producto: d.producto,
    ultimaAplicacion: aFecha(d.fecha),
    proximaFecha: d.proximaFecha ? aFecha(d.proximaFecha) : null,
    estado: estadoPorFecha(d.proximaFecha, hoy),
  }));
};

const PRIORIDAD: Record<EstadoVacuna, number> = {
  vencida: 0,
  pendiente: 1,
  por_vencer: 2,
  vigente: 3,
  no_aplica_aun: 4,
};

/**
 * Convierte el estado de vacunación de una mascota en avisos: lo atrasado
 * primero y luego lo próximo por fecha. Solo entra lo que tiene algo que hacer
 * o una fecha a la vista.
 */
export const avisosDeMascota = (
  mascota: { id: string; nombre: string },
  estado: EstadoVacunacion,
): Aviso[] => {
  const base = { mascotaId: mascota.id, mascotaNombre: mascota.nombre };
  const vacunas: Aviso[] = estado.vacunas
    .filter((v) => v.estado !== 'vigente' || v.proximaFecha)
    .map((v) => ({
      ...base,
      tipo: 'vacuna',
      nombre: v.vacuna,
      fecha: v.estado === 'vencida' ? v.fechaVencimiento : v.proximaFecha,
      estado: v.estado,
    }));
  const desparasitaciones: Aviso[] = estado.desparasitaciones
    .filter((d) => d.proximaFecha)
    .map((d) => ({
      ...base,
      tipo: 'desparasitacion',
      nombre: d.tipo ? `Desparasitación ${d.tipo}` : 'Desparasitación',
      fecha: d.proximaFecha,
      estado: d.estado,
    }));
  return [...vacunas, ...desparasitaciones];
};

/** Orden de los avisos: estado (atrasado primero) y después fecha. */
export const ordenarAvisos = (avisos: Aviso[]): Aviso[] =>
  [...avisos].sort(
    (a, b) =>
      PRIORIDAD[a.estado] - PRIORIDAD[b.estado] ||
      (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'),
  );
