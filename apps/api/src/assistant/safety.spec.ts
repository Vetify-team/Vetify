import { describe, expect, it } from 'vitest';
import { detectEmergency, EMERGENCY_REPLY, normalize } from './safety.js';

describe('normalize', () => {
  it('drops accents, case and punctuation', () => {
    expect(normalize('¡Mi PERRA convulsionó!  ¿Qué hago?')).toBe(
      'mi perra convulsiono que hago',
    );
    expect(normalize('Está muy decaído, señor')).toBe('esta muy decaido senor');
  });
});

describe('detectEmergency', () => {
  it.each([
    'Mi perro está convulsionando',
    'MI GATA CONVULSIONÓ HACE UN RATO',
    'Tuvo un ataque epiléptico',
    'No respira bien y tiene la lengua morada',
    'Tiene dificultad para respirar',
    'le cuesta respirar desde anoche',
    'Creo que se está ahogando con algo',
    'Creo que lo envenenaron',
    'Está intoxicado',
    'Se comió el raticida del patio',
    'Se comió una barra de chocolate',
    'se comio una barra entera de chocolate',
    'comió veneno para ratas',
    'Tragó unas pastillas de ibuprofeno',
    'Está sangrando mucho de la pata',
    'Sangra sin parar',
    'hay mucha sangre',
    'Lo atropelló un carro',
    'Tiene el abdomen hinchado y hace arcadas',
    'la panza muy hinchada, quiere vomitar y no puede',
    'Hace arcadas y tiene la barriga inflamada',
    'No orina desde ayer',
    'No ha orinado en todo el día',
    'no puede hacer pipí',
    'Perdió la conciencia un momento',
    'Está inconsciente',
    'Se desmayó en el parque',
    'No reacciona cuando lo llamo',
    'Creo que le dio un golpe de calor',
    'Tiene insolación',
  ])('flags "%s"', (text) => {
    expect(detectEmergency(text)).toBe(true);
  });

  it.each([
    '¿Cada cuánto debo desparasitar a mi perro?',
    '¿Qué vacunas le tocan este año?',
    'Respira normal pero ronca un poco al dormir',
    '¿Qué plantas son venenosas para gatos?',
    '¿Qué le doy de comer? Le gusta el pollo',
    'Tiene la panza hinchada después de comer',
    'Le cortaron las uñas y sangró un poquito',
    'Orina mucho desde que hace calor',
    '¿Cómo lo protejo del calor en verano?',
    'Resumen pre-consulta, por favor',
  ])('does not flag "%s"', (text) => {
    expect(detectEmergency(text)).toBe(false);
  });

  it('tells the owner to go to an emergency clinic now', () => {
    expect(EMERGENCY_REPLY).toMatch(/^Esto puede ser una emergencia\./);
    expect(EMERGENCY_REPLY).toMatch(/veterinaria de emergencias ahora/);
  });
});
