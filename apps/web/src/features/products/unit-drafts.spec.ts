import {
  createUnitDraft,
  emptyUnitValue,
  toCreateUnitPayload,
  validateUnitValue,
} from '@/features/products/unit-drafts';

const t = (key: string, params?: Record<string, string | number>) =>
  params === undefined ? key : `${key}:${JSON.stringify(params)}`;

describe('unit draft validation', () => {
  it('accepts a base unit and a unique extra unit with a valid factor', () => {
    const errors = validateUnitValue(
      {
        baseUnit: 'bottle',
        units: [{ key: 'u1', name: 'carton', conversionFactor: '24' }],
      },
      t,
    );

    expect(errors.hasErrors).toBe(false);
    expect(errors.baseUnit).toBeUndefined();
    expect(errors.units).toEqual({});
  });

  it('requires a base unit', () => {
    const errors = validateUnitValue(emptyUnitValue(), t);

    expect(errors.hasErrors).toBe(true);
    expect(errors.baseUnit).toBe('validation.required');
  });

  it('rejects duplicate unit names, including the base unit', () => {
    const errors = validateUnitValue(
      {
        baseUnit: 'bottle',
        units: [
          { key: 'u1', name: 'Bottle', conversionFactor: '24' },
          { key: 'u2', name: 'carton', conversionFactor: '12' },
          { key: 'u3', name: 'Carton', conversionFactor: '6' },
        ],
      },
      t,
    );

    expect(errors.units.u1?.name).toBe('validation.unitName');
    expect(errors.units.u3?.name).toBe('validation.unitName');
    expect(errors.units.u2?.name).toBeUndefined();
  });

  it('rejects empty, one, zero, and non-decimal conversion factors', () => {
    for (const factor of ['', '1', '0', 'abc']) {
      const errors = validateUnitValue(
        {
          baseUnit: 'bottle',
          units: [{ key: 'u1', name: 'carton', conversionFactor: factor }],
        },
        t,
      );

      expect(errors.units.u1?.conversionFactor).toBeDefined();
    }
  });

  it('rejects more than twenty extra units', () => {
    const units = Array.from({ length: 21 }, (_, index) =>
      createUnitDraft(`unit-${String(index)}`, '2'),
    );
    const errors = validateUnitValue({ baseUnit: 'bottle', units }, t);

    expect(errors.baseUnit).toBe('validation.maxUnits');
  });

  it('builds a trimmed create payload', () => {
    expect(
      toCreateUnitPayload({
        baseUnit: ' bottle ',
        units: [
          { key: 'u1', name: ' carton ', conversionFactor: ' 24 ' },
          { key: 'u2', name: '', conversionFactor: '' },
        ],
      }),
    ).toEqual({
      baseUnit: 'bottle',
      units: [{ name: 'carton', conversionFactor: '24' }],
    });
  });
});
