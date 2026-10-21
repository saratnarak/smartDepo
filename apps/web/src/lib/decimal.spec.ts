import {
  calculateLineTotal,
  compareDecimal,
  divideDecimal,
  formatDecimal,
  formatReadableQuantity,
  formatUnitPreview,
  isPositiveQuantity,
  isValidConversionFactor,
  isValidPrice,
  isValidQuantity,
  isValidSignedQuantity,
  multiplyDecimal,
  roundToMoney,
  roundToQuantity,
  sumDecimals,
  toBaseQuantity,
  toBaseUnitCost,
} from '@/lib/decimal';
import { formatMoney, moneyDecimals } from '@/lib/format';

const BOTTLE = { name: 'bottle', conversionFactor: '1', isBaseUnit: true };
const CARTON = { name: 'carton', conversionFactor: '24', isBaseUnit: false };
const KG = { name: 'kg', conversionFactor: '1', isBaseUnit: true };
const SACK = { name: 'sack', conversionFactor: '50', isBaseUnit: false };

describe('decimal helpers', () => {
  it('formats base quantities in readable units', () => {
    expect(formatReadableQuantity('293', [BOTTLE, CARTON])).toBe('12 cartons and 5 bottles');
    expect(formatReadableQuantity('52.25', [KG, SACK])).toBe('1 sack and 2.25 kg');
    expect(formatReadableQuantity('23', [BOTTLE, CARTON])).toBe('23 bottles');
    expect(formatReadableQuantity('24', [BOTTLE, CARTON])).toBe('1 carton');
  });

  it('can skip pluralisation and use a translated conjunction', () => {
    expect(
      formatReadableQuantity('293', [BOTTLE, CARTON], {
        conjunction: 'និង',
        pluralize: false,
      }),
    ).toBe('12 carton និង 5 bottle');
  });

  it('builds a unit conversion preview', () => {
    expect(formatUnitPreview('carton', '24', 'bottle')).toBe('1 carton = 24 bottles');
    expect(formatUnitPreview('sack', '50', 'kg')).toBe('1 sack = 50 kg');
    expect(formatUnitPreview('carton', '1', 'bottle')).toBe('1 carton = 1 bottle');
    expect(formatUnitPreview('', '', '')).toContain('=');
  });

  it('formats money without converting it to a float', () => {
    expect(formatMoney('1234.5', 'USD', 'en')).toBe('1,234.50 USD');
    expect(formatMoney('0', 'KHR', 'en')).toBe('0 KHR');
    expect(formatMoney('999999999999.99', 'KHR', 'en')).toBe('999,999,999,999.99 KHR');
    expect(formatMoney('not-a-number', 'USD', 'en')).toBe('not-a-number USD');
  });

  it('follows the currency of the depot for the number of decimals', () => {
    expect(moneyDecimals('KHR')).toBe(0);
    expect(moneyDecimals('USD')).toBe(2);
    expect(formatMoney('288.00', 'KHR', 'en')).toBe('288 KHR');
    expect(formatMoney('288.00', 'USD', 'en')).toBe('288.00 USD');
    // An amount that really has cents keeps them, so nothing is rounded away.
    expect(formatMoney('1.50', 'KHR', 'en')).toBe('1.50 KHR');
    expect(formatMoney('12.345', 'USD', 'en')).toBe('12.35 USD');
    expect(formatMoney('1.50', 'KHR', 'en', { decimals: 2 })).toBe('1.50 KHR');
  });

  it('trims display decimals and compares decimal strings', () => {
    expect(formatDecimal('120.000')).toBe('120');
    expect(formatDecimal('1.250')).toBe('1.25');
    expect(compareDecimal('5', '5.000')).toBe(0);
    expect(compareDecimal('5.1', '5.01')).toBe(1);
    expect(compareDecimal('4', '4.5')).toBe(-1);
  });

  it('validates quantities, factors, and prices', () => {
    expect(isValidQuantity('12.345')).toBe(true);
    expect(isValidQuantity('12.3456')).toBe(false);
    expect(isValidQuantity('-1')).toBe(false);
    expect(isValidConversionFactor('24')).toBe(true);
    expect(isValidConversionFactor('1.5')).toBe(true);
    expect(isValidConversionFactor('1')).toBe(false);
    expect(isValidConversionFactor('0')).toBe(false);
    expect(isValidConversionFactor('abc')).toBe(false);
    expect(isValidPrice('1.50')).toBe(true);
    expect(isValidPrice('1.555')).toBe(false);
  });

  it('multiplies and divides decimals without floating point', () => {
    expect(multiplyDecimal('12', '24')).toBe('288');
    expect(multiplyDecimal('2.5', '1.50')).toBe('3.75');
    expect(multiplyDecimal('0.1', '0.2')).toBe('0.02');
    expect(divideDecimal('10', '24')).toBe('0.416667');
    expect(divideDecimal('10', '0')).toBeNull();
    expect(multiplyDecimal('abc', '2')).toBeNull();
  });

  it('rounds money and quantities to the database scale', () => {
    expect(roundToMoney('1.005')).toBe('1.01');
    expect(roundToMoney('288')).toBe('288');
    expect(roundToQuantity('12.3456')).toBe('12.346');
    expect(roundToMoney('not-a-number')).toBeNull();
  });

  it('sums decimals and converts to base units and base unit costs', () => {
    expect(sumDecimals(['288', '12.50'])).toBe('300.5');
    expect(sumDecimals(['288', 'x'])).toBeNull();
    expect(toBaseQuantity('12', '24')).toBe('288');
    expect(toBaseQuantity('2.5', '2')).toBe('5');
    expect(toBaseUnitCost('24.00', '24')).toBe('1');
    expect(toBaseUnitCost('10.00', '24')).toBe('0.42');
  });

  it('calculates purchase line totals with decimal arithmetic', () => {
    expect(calculateLineTotal('12', '24.00')).toBe('288');
    expect(calculateLineTotal('2.5', '1.50')).toBe('3.75');
    expect(calculateLineTotal('0', '24.00')).toBe('0');
    expect(calculateLineTotal('12', '')).toBeNull();
  });

  it('validates signed and positive quantities', () => {
    expect(isValidSignedQuantity('-2')).toBe(true);
    expect(isValidSignedQuantity('-2.5')).toBe(true);
    expect(isValidSignedQuantity('2.5555')).toBe(false);
    expect(isValidSignedQuantity('abc')).toBe(false);
    expect(isPositiveQuantity('2')).toBe(true);
    expect(isPositiveQuantity('0')).toBe(false);
    expect(isPositiveQuantity('-2')).toBe(false);
  });
});
