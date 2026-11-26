import { TEXTS } from '@/constants/texts';

type ErrorLike = {
  code?: unknown;
  message?: unknown;
};

function isErrorLike(error: unknown): error is ErrorLike {
  return typeof error === 'object' && error !== null;
}

// Supabase (PostgREST) xatosini foydalanuvchiga tushunarli matnga aylantiradi.
export function getDbErrorMessage(error: unknown): string {
  if (!isErrorLike(error)) {
    return TEXTS.authErrors.unknown;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  if (error instanceof TypeError || /network request failed|failed to fetch/i.test(message)) {
    return TEXTS.authErrors.network;
  }
  switch (error.code) {
    case '23505':
      return TEXTS.dbErrors.duplicateCategory;
    case '23503':
      return TEXTS.dbErrors.categoryMismatch;
    case 'FW001':
      return TEXTS.dbErrors.stockHasMovements;
    case 'FE001':
      return TEXTS.dbErrors.employeeHasPayments;
    case 'FE002':
      return TEXTS.dbErrors.employeeCurrencyLocked;
    case 'FE003':
      return TEXTS.dbErrors.employeeAccountNotMember;
    case 'FO001':
      return TEXTS.dbErrors.orderOverpay;
    case 'FO002':
      return TEXTS.dbErrors.sellerNotMember;
    case 'FO003':
      return TEXTS.dbErrors.rateUnrealistic;
    case 'FO004':
      return TEXTS.dbErrors.orderPriceBelowPaid;
    case 'FO005':
      return TEXTS.dbErrors.orderCurrencyLocked;
    case 'FO006':
      return TEXTS.dbErrors.orderCancelled;
    case 'FB001':
      return TEXTS.dbErrors.alreadyMember;
    case 'FB002':
      return TEXTS.dbErrors.joinCodeNotFound;
    case 'FB003':
      return TEXTS.dbErrors.ownerOnly;
    case 'FB004':
      return TEXTS.dbErrors.ownerCannotLeave;
    case 'FB005':
      return TEXTS.dbErrors.memberNotFound;
    case 'FD001':
      return TEXTS.dbErrors.overpay;
    case 'FD002':
      return TEXTS.dbErrors.amountBelowPaid;
    case 'FD003':
      return TEXTS.dbErrors.debtLockedByPayments;
    case '42501':
    case 'PGRST301':
      return TEXTS.dbErrors.permission;
    default:
      return TEXTS.authErrors.unknown;
  }
}
