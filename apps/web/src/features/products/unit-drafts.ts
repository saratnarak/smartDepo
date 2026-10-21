import { isValidConversionFactor } from '@/lib/decimal';

export interface UnitDraft {
  key: string;
  name: string;
  conversionFactor: string;
}

export interface UnitDraftValue {
  baseUnit: string;
  units: UnitDraft[];
}

export interface UnitDraftErrors {
  baseUnit?: string;
  units: Record<string, { name?: string; conversionFactor?: string }>;
  hasErrors: boolean;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

let draftCounter = 0;

export function createUnitDraft(name = '', conversionFactor = ''): UnitDraft {
  draftCounter += 1;
  return { key: `unit-${String(draftCounter)}`, name, conversionFactor };
}

export function emptyUnitValue(): UnitDraftValue {
  return { baseUnit: '', units: [] };
}

/**
 * Validates the create-mode unit editor. The first unit is the base unit with a fixed factor of 1;
 * additional units need a unique name and a positive factor different from 1. Returns translated
 * messages so the form can render them directly.
 */
export function validateUnitValue(value: UnitDraftValue, t: Translate): UnitDraftErrors {
  const errors: UnitDraftErrors = { units: {}, hasErrors: false };
  const base = value.baseUnit.trim();

  if (base === '') {
    errors.baseUnit = t('validation.required');
  } else if (base.length > 40) {
    errors.baseUnit = t('validation.maxLength', { max: 40 });
  }

  if (value.units.length > 20) {
    errors.baseUnit = t('validation.maxUnits');
  }

  const seen = new Set<string>();

  if (base !== '') {
    seen.add(base.toLowerCase());
  }

  for (const unit of value.units) {
    const name = unit.name.trim();
    const factor = unit.conversionFactor.trim();
    const unitErrors: { name?: string; conversionFactor?: string } = {};

    if (name === '') {
      unitErrors.name = t('validation.required');
    } else if (name.length > 40) {
      unitErrors.name = t('validation.maxLength', { max: 40 });
    } else if (seen.has(name.toLowerCase())) {
      unitErrors.name = t('validation.unitName');
    } else {
      seen.add(name.toLowerCase());
    }

    if (factor === '') {
      unitErrors.conversionFactor = t('validation.required');
    } else if (!isValidConversionFactor(factor)) {
      unitErrors.conversionFactor = t('validation.conversionFactor');
    }

    if (unitErrors.name !== undefined || unitErrors.conversionFactor !== undefined) {
      errors.units[unit.key] = unitErrors;
      errors.hasErrors = true;
    }
  }

  if (errors.baseUnit !== undefined) {
    errors.hasErrors = true;
  }

  return errors;
}

export function toCreateUnitPayload(value: UnitDraftValue): {
  baseUnit: string;
  units: Array<{ name: string; conversionFactor: string }>;
} {
  return {
    baseUnit: value.baseUnit.trim(),
    units: value.units
      .map((unit) => ({
        name: unit.name.trim(),
        conversionFactor: unit.conversionFactor.trim(),
      }))
      .filter((unit) => unit.name !== '' || unit.conversionFactor !== ''),
  };
}
