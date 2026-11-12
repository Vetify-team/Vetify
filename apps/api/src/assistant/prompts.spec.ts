import { describe, expect, it } from 'vitest';
import { fromIsoDate } from '../common/dates.js';
import { describeToday, systemPrompt } from './prompts.js';

describe('systemPrompt', () => {
  const today = fromIsoDate('2026-11-12');

  it('states today in words and as a date, in Costa Rica time', () => {
    expect(describeToday(today)).toBe(
      'jueves, 12 de noviembre de 2026 (2026-11-12)',
    );
    for (const mode of ['owner', 'clinic'] as const) {
      expect(systemPrompt(mode, today)).toContain(
        'Hoy es jueves, 12 de noviembre de 2026 (2026-11-12), hora de Costa Rica.',
      );
    }
  });

  it('keeps the calendar day of a date at UTC midnight', () => {
    expect(describeToday(fromIsoDate('2027-01-01'))).toMatch(
      /^viernes, 1 de enero de 2027/,
    );
  });

  it('leaves the "guidance, not a consultation" notice to the interface', () => {
    const owner = systemPrompt('owner', today);
    expect(owner).not.toMatch(/cerrá con una línea/);
    expect(owner).toMatch(/la aplicación ya lo muestra siempre/);
  });

  it('tells the model to use the computed statuses as they are', () => {
    expect(systemPrompt('owner', today)).toMatch(
      /ya vienen calculados al día de hoy/,
    );
  });
});
