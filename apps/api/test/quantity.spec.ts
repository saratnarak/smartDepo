import { Prisma } from '../src/generated/prisma/client.js';
import {
  assertNonBaseConversionFactor,
  assertNonNegativeQuantity,
  formatBaseQuantity,
  toBaseQuantity,
} from '../src/common/units/quantity.js';

const bottleUnits = [
  { name: 'bottle', conversionFactor: '1', isBaseUnit: true },
  { name: 'carton', conversionFactor: '24', isBaseUnit: false },
];

const kgUnits = [
  { name: 'kg', conversionFactor: '1', isBaseUnit: true },
  { name: 'sack', conversionFactor: '50', isBaseUnit: false },
];

describe('quantity conversion', () => {
  it('converts whole units to the base unit', () => {
    expect(toBaseQuantity('12', '24').toString()).toBe('288');
    expect(toBaseQuantity('2', '50').toString()).toBe('100');
  });

  it('keeps fractional kilograms exact', () => {
    expect(toBaseQuantity('2.5', '1').toString()).toBe('2.5');
    expect(toBaseQuantity('0.125', '1').toString()).toBe('0.125');
    expect(toBaseQuantity('0.333', '3').toString()).toBe('0.999');
  });

  it('rounds to the three-decimal quantity scale', () => {
    expect(toBaseQuantity('0.3334', '1').toString()).toBe('0.333');
    expect(toBaseQuantity('0.3335', '1').toString()).toBe('0.334');
  });

  it('rejects zero, negative, and invalid conversion factors', () => {
    expect(() => toBaseQuantity('1', '0')).toThrow('conversion factor must be positive');
    expect(() => toBaseQuantity('1', '-2')).toThrow('conversion factor must be positive');
    expect(() => toBaseQuantity('1', 'not-a-number')).toThrow('valid decimal');
  });

  it('rejects an additional unit factor of 1', () => {
    expect(() => assertNonBaseConversionFactor('1')).toThrow(
      'must have a conversion factor different from 1',
    );
    expect(assertNonBaseConversionFactor('24').toString()).toBe('24');
  });

  it('rejects negative quantities where non-negative input is required', () => {
    expect(() => assertNonNegativeQuantity('-1')).toThrow('must not be negative');
    expect(assertNonNegativeQuantity('0').toString()).toBe('0');
  });
});

describe('base quantity formatting', () => {
  it('formats cartons and bottles', () => {
    expect(formatBaseQuantity('293', bottleUnits)).toBe('12 cartons and 5 bottles');
    expect(formatBaseQuantity('25', bottleUnits)).toBe('1 carton and 1 bottle');
    expect(formatBaseQuantity('24', bottleUnits)).toBe('1 carton');
    expect(formatBaseQuantity('1', bottleUnits)).toBe('1 bottle');
    expect(formatBaseQuantity('0', bottleUnits)).toBe('0 bottles');
  });

  it('formats fractional kilograms without inventing sacks', () => {
    expect(formatBaseQuantity('2.5', kgUnits)).toBe('2.5 kg');
    expect(formatBaseQuantity('52.25', kgUnits)).toBe('1 sack and 2.25 kg');
    expect(formatBaseQuantity('50', kgUnits)).toBe('1 sack');
  });

  it('formats negative stock with the sign on the whole result', () => {
    expect(formatBaseQuantity('-25', bottleUnits)).toBe('-1 carton and 1 bottle');
  });

  it('formats a fractional base unit with plural wording', () => {
    expect(formatBaseQuantity('0.5', bottleUnits)).toBe('0.5 bottles');
  });

  it('rejects a missing base unit or an invalid factor', () => {
    expect(() => formatBaseQuantity('1', [{ name: 'carton', conversionFactor: '24' }])).toThrow(
      'base unit is required',
    );
    expect(() =>
      formatBaseQuantity('1', [
        { name: 'bottle', conversionFactor: '1', isBaseUnit: true },
        { name: 'broken', conversionFactor: '0' },
      ]),
    ).toThrow('conversion factor must be positive');
  });

  it('uses Prisma decimal values without floating point arithmetic', () => {
    expect(formatBaseQuantity(new Prisma.Decimal('25.5'), bottleUnits)).toBe(
      '1 carton and 1.5 bottles',
    );
  });
});
