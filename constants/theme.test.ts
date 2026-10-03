import { describe, expect, it } from 'vitest';

import { fontForWeight, fonts } from './theme';

describe('fontForWeight', () => {
  it('maps numeric weights to the matching Geist family', () => {
    expect(fontForWeight(100)).toBe(fonts.regular);
    expect(fontForWeight(400)).toBe(fonts.regular);
    expect(fontForWeight(500)).toBe(fonts.medium);
    expect(fontForWeight(600)).toBe(fonts.semibold);
    expect(fontForWeight(700)).toBe(fonts.bold);
    expect(fontForWeight(900)).toBe(fonts.bold);
  });

  it('handles keyword weights and missing values', () => {
    expect(fontForWeight('bold')).toBe(fonts.bold);
    expect(fontForWeight('normal')).toBe(fonts.regular);
    expect(fontForWeight(undefined)).toBe(fonts.regular);
    expect(fontForWeight(null)).toBe(fonts.regular);
  });
});
