import {
  calculateLineTotal,
  isPositiveQuantity,
  isValidPrice,
  roundToMoney,
  sumDecimals,
} from '@/lib/decimal';
import type { TranslationParams } from '@/i18n/config';
import type { Product, ProductUnit } from '@/lib/types';

type Translate = (key: string, params?: TranslationParams) => string;

export interface PurchaseLineDraft {
  productId: string;
  unitId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
}

export type LineField = keyof PurchaseLineDraft;

export type LineErrors = Partial<Record<LineField, string>>;

export interface LineContext {
  product: Product | null;
  units: ProductUnit[];
  trackBatches: boolean;
}

export function emptyLineDraft(): PurchaseLineDraft {
  return {
    productId: '',
    unitId: '',
    quantity: '',
    unitCost: '',
    batchNumber: '',
    expiryDate: '',
  };
}

/** Line total of one draft line, computed with decimal arithmetic only. */
export function draftLineTotal(draft: PurchaseLineDraft): string | null {
  const quantity = draft.quantity.trim();
  const unitCost = draft.unitCost.trim();

  if (quantity === '' || unitCost === '') {
    return null;
  }

  return calculateLineTotal(quantity, unitCost);
}

/** Total of every draft line. */
export function draftTotal(drafts: readonly PurchaseLineDraft[]): string | null {
  const totals: string[] = [];

  for (const draft of drafts) {
    const total = draftLineTotal(draft);

    if (total === null) {
      return null;
    }

    totals.push(total);
  }

  const sum = sumDecimals(totals);
  return sum === null ? null : roundToMoney(sum);
}

/** Validates one draft line and returns the messages for the fields that failed. */
export function validateLineDraft(
  draft: PurchaseLineDraft,
  context: LineContext,
  t: Translate,
): LineErrors {
  const errors: LineErrors = {};
  const quantity = draft.quantity.trim();
  const unitCost = draft.unitCost.trim();

  if (draft.productId === '') {
    errors.productId = t('validation.required');
  }

  if (draft.unitId === '') {
    errors.unitId = t('validation.required');
  }

  if (quantity === '') {
    errors.quantity = t('validation.required');
  } else if (!isPositiveQuantity(quantity)) {
    errors.quantity = t('validation.quantity');
  }

  if (unitCost === '') {
    errors.unitCost = t('validation.required');
  } else if (!isValidPrice(unitCost)) {
    errors.unitCost = t('validation.priceAmount');
  }

  if (context.trackBatches) {
    const batchNumber = draft.batchNumber.trim();

    if (batchNumber === '') {
      errors.batchNumber = t('validation.required');
    } else if (batchNumber.length > 80) {
      errors.batchNumber = t('validation.maxLength', { max: 80 });
    }

    if (draft.expiryDate.trim() === '') {
      errors.expiryDate = t('validation.required');
    } else if (Number.isNaN(new Date(draft.expiryDate).getTime())) {
      errors.expiryDate = t('validation.expiryDate');
    }
  }

  return errors;
}

export function hasErrors(errors: LineErrors): boolean {
  return Object.keys(errors).length > 0;
}
