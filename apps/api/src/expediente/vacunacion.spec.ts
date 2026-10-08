import { describe, expect, it } from 'vitest';
import { desdeFecha } from '../common/mapeo.js';
import {
  avisosDeMascota,
  calcularEstadoVacunacion,
  ordenarAvisos,
  sumarMeses,
  type ReglaEsquema,
} from './vacunacion.js';

const esquema: ReglaEsquema[] = [
  { vacuna: 'Polivalente', edadMinimaMeses: 2, vigenciaMeses: 12 },
  { vacuna: 'Rabia', edadMinimaMeses: 3, vigenciaMeses: 12 },
  { vacuna: 'Leptospirosis', edadMinimaMeses: 3, vigenciaMeses: 12 },
  { vacuna: 'Tos de las perreras', edadMinimaMeses: 3, vigenciaMeses: 12 },
];

const hoy = desdeFecha('2026-10-07');

const calcular = (
  aplicadas: {
    tipo: string;
    fechaAplicacion: string;
    fechaVencimiento?: string;
  }[],
  nacimiento: string | null,
) =>
  calcularEstadoVacunacion({
    pais: 'CR',
    especie: 'perro',
    esquema,
    aplicadas: aplicadas.map((a) => ({
      tipo: a.tipo,
      fechaAplicacion: desdeFecha(a.fechaAplicacion),
      fechaVencimiento: a.fechaVencimiento
        ? desdeFecha(a.fechaVencimiento)
        : null,
    })),
    fechaNacimiento: nacimiento ? desdeFecha(nacimiento) : null,
    hoy,
  });

const estadoDe = (resultado: ReturnType<typeof calcular>, vacuna: string) =>
  resultado.vacunas.find((v) => v.vacuna === vacuna);

describe('calcularEstadoVacunacion', () => {
  it('clasifica vigente, por vencer, vencida y pendiente', () => {
    const resultado = calcular(
      [
        { tipo: 'Polivalente', fechaAplicacion: '2026-03-01' }, // vence 2027-03-01
        { tipo: 'rabia', fechaAplicacion: '2025-10-20' }, // vence 2026-10-20: 13 días
        { tipo: 'Leptospirosis', fechaAplicacion: '2025-01-10' }, // venció 2026-01-10
      ],
      '2022-05-01',
    );

    expect(estadoDe(resultado, 'Polivalente')).toMatchObject({
      estado: 'vigente',
      fechaVencimiento: '2027-03-01',
    });
    expect(estadoDe(resultado, 'Rabia')).toMatchObject({
      estado: 'por_vencer',
      proximaFecha: '2026-10-20',
    });
    expect(estadoDe(resultado, 'Leptospirosis')).toMatchObject({
      estado: 'vencida',
      proximaFecha: null,
    });
    expect(estadoDe(resultado, 'Tos de las perreras')).toMatchObject({
      estado: 'pendiente',
    });
    expect(resultado.cobertura).toBe(50);
  });

  it('usa la última aplicación y respeta un vencimiento indicado por la clínica', () => {
    const resultado = calcular(
      [
        { tipo: 'Rabia', fechaAplicacion: '2024-01-01' },
        {
          tipo: 'Rabia',
          fechaAplicacion: '2026-06-01',
          fechaVencimiento: '2029-06-01',
        },
      ],
      '2022-05-01',
    );

    expect(estadoDe(resultado, 'Rabia')).toMatchObject({
      estado: 'vigente',
      ultimaAplicacion: '2026-06-01',
      fechaVencimiento: '2029-06-01',
    });
  });

  it('marca como "no aplica aún" a un cachorro sin la edad mínima y dice cuándo toca', () => {
    // Nació el 20/07: cumplió 2 meses el 20/09 y cumple 3 el 20/10.
    const resultado = calcular([], '2026-07-20');

    expect(estadoDe(resultado, 'Polivalente')).toMatchObject({
      estado: 'pendiente',
    });
    expect(estadoDe(resultado, 'Rabia')).toMatchObject({
      estado: 'no_aplica_aun',
      proximaFecha: '2026-10-20',
    });
  });

  it('sin fecha de nacimiento asume que la vacuna ya corresponde', () => {
    expect(estadoDe(calcular([], null), 'Rabia')).toMatchObject({
      estado: 'pendiente',
      proximaFecha: null,
    });
  });
});

describe('sumarMeses', () => {
  it('ajusta al último día cuando el mes destino es más corto', () => {
    expect(
      sumarMeses(desdeFecha('2026-01-31'), 1).toISOString().slice(0, 10),
    ).toBe('2026-02-28');
  });
});

describe('desparasitaciones y avisos', () => {
  it('toma la última desparasitación de cada tipo y calcula su estado', () => {
    const resultado = calcularEstadoVacunacion({
      pais: 'CR',
      especie: 'perro',
      esquema: [],
      aplicadas: [],
      desparasitaciones: [
        {
          tipo: 'interna',
          producto: 'A',
          fecha: desdeFecha('2026-01-01'),
          proximaFecha: desdeFecha('2026-04-01'),
        },
        {
          tipo: 'interna',
          producto: 'B',
          fecha: desdeFecha('2026-07-01'),
          proximaFecha: desdeFecha('2026-10-19'),
        },
        {
          tipo: 'externa',
          producto: 'C',
          fecha: desdeFecha('2026-09-01'),
          proximaFecha: null,
        },
      ],
      fechaNacimiento: null,
      hoy,
    });

    expect(resultado.desparasitaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'interna',
          producto: 'B',
          estado: 'por_vencer',
          proximaFecha: '2026-10-19',
        }),
        expect.objectContaining({
          tipo: 'externa',
          estado: 'vigente',
          proximaFecha: null,
        }),
      ]),
    );
    expect(resultado.desparasitaciones).toHaveLength(2);
  });

  it('ordena los avisos con lo atrasado primero y luego por fecha', () => {
    const estado = calcular(
      [
        { tipo: 'Polivalente', fechaAplicacion: '2026-03-01' },
        { tipo: 'Rabia', fechaAplicacion: '2025-10-20' },
        { tipo: 'Leptospirosis', fechaAplicacion: '2025-01-10' },
      ],
      '2022-05-01',
    );
    const avisos = ordenarAvisos(
      avisosDeMascota({ id: 'm1', nombre: 'Luna' }, estado),
    );

    expect(avisos.map((a) => `${a.nombre}:${a.estado}`)).toEqual([
      'Leptospirosis:vencida',
      'Tos de las perreras:pendiente',
      'Rabia:por_vencer',
      'Polivalente:vigente',
    ]);
    expect(avisos[0]).toMatchObject({
      mascotaNombre: 'Luna',
      fecha: '2026-01-10',
    });
  });
});
