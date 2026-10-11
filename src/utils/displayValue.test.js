import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeNumber, formatDisplayDate } from './displayValue';

describe('displayValue helpers', () => {
  it('returns meaningful fallback text for missing values', () => {
    expect(sanitizeText('', 'No recorded data')).toBe('No recorded data');
    expect(sanitizeText('  ')).toBe('Not available');
    expect(sanitizeText('Supplier A')).toBe('Supplier A');
  });

  it('clamps invalid and negative numbers to zero', () => {
    expect(sanitizeNumber(-4)).toBe(0);
    expect(sanitizeNumber('')).toBe(0);
    expect(sanitizeNumber('12')).toBe(12);
  });

  it('formats dates without showing invalid placeholders', () => {
    expect(formatDisplayDate('2026-08-08')).toContain('2026');
    expect(formatDisplayDate('invalid-date')).toBe('Date not available');
  });
});
