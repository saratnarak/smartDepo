import { calculateLineTotal, toBaseUnitCost, toMoney } from '../src/common/money/money.js';
import {
  damageQuantity,
  isLowStock,
  readableStock,
  stockFromMovements,
} from '../src/modules/stock/stock-calculations.js';

const bottleUnits = [
  { name: 'bottle', conversionFactor: '1', isBaseUnit: true },
  { name: 'carton', conversionFactor: '24', isBaseUnit: false },
];

describe('stock derivation', () => {
  it('sums signed movements into current stock', () => {
    expect(stockFromMovements(['100', '-24', '-6', '2']).toString()).toBe('72');
    expect(stockFromMovements([]).toString()).toBe('0');
  });

  it('keeps fractional base units exact', () => {
    expect(stockFromMovements(['52.25', '-2.25']).toString()).toBe('50');
  });

  it('compares current stock with the reorder level', () => {
    expect(isLowStock('120', '120')).toBe(true);
    expect(isLowStock('119.999', '120')).toBe(true);
    expect(isLowStock('120.001', '120')).toBe(false);
  });

  it('turns a positive damage amount into a negative movement', () => {
    expect(damageQuantity('2').toString()).toBe('-2');
    expect(() => damageQuantity('0')).toThrow('greater than zero');
  });

  it('formats derived stock in readable units', () => {
    expect(readableStock('293', bottleUnits)).toBe('12 cartons and 5 bottles');
  });
});

describe('purchase money', () => {
  it('rounds money to two decimals without floating point', () => {
    expect(toMoney('1.005').toString()).toBe('1.01');
    expect(toMoney('1.004').toString()).toBe('1');
  });

  it('calculates a line total from quantity and entered unit cost', () => {
    expect(calculateLineTotal('12', '24.00').toString()).toBe('288');
    expect(calculateLineTotal('2.5', '1.50').toString()).toBe('3.75');
  });

  it('converts the entered unit cost to a per-base-unit cost', () => {
    expect(toBaseUnitCost('24.00', '24').toString()).toBe('1');
    expect(toBaseUnitCost('10.00', '24').toString()).toBe('0.42');
    expect(toBaseUnitCost('50.00', '50').toString()).toBe('1');
  });
});
