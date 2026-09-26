import { describe, expect, it } from 'vitest';
import { containsBadWord } from './badwords';

describe('containsBadWord', () => {
  it('finds offensive stems in any position and spelling', () => {
    expect(containsBadWord('Du Arschloch!')).toBe(true);
    expect(containsBadWord('scheißegal')).toBe(true);
    expect(containsBadWord('Das ist FUCK')).toBe(true);
    expect(containsBadWord('die Hure')).toBe(true);
  });

  it('leaves ordinary words alone', () => {
    for (const ok of ['dick', 'der Schwanz des Hundes', 'Fischer', 'Kanal', 'nach Hause', 'Hitze', 'Shirt', 'Assistent']) {
      expect(containsBadWord(ok), ok).toBe(false);
    }
  });
});
