import { Transaction, type AtomicBEEF } from '@bsv/sdk'

export type PaymentTransactionFormat = 'atomic' | 'legacy-converted'

export class InvalidPaymentTransactionError extends Error {
  constructor() {
    super('This payment uses an invalid or unsupported transaction format.')
    this.name = 'InvalidPaymentTransactionError'
  }
}

function transactionBytes(value: unknown): number[] {
  let bytes: unknown = value instanceof Uint8Array ? Array.from(value) : value

  // JSON.stringify(Uint8Array) produces an object with contiguous numeric
  // keys. Some historical payment senders placed that representation directly
  // in Message Box tokens, so recover it before validating the byte payload.
  if (bytes != null && typeof bytes === 'object' && !Array.isArray(bytes)) {
    const entries = Object.entries(bytes)
    if (entries.length > 0 && entries.every(([key], index) => key === String(index))) {
      bytes = entries.map(([, byte]) => byte)
    }
  }

  if (!Array.isArray(bytes) || bytes.length === 0 || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new InvalidPaymentTransactionError()
  }
  return bytes
}

export function normalizePaymentTransaction(value: unknown): {
  transaction: AtomicBEEF
  format: PaymentTransactionFormat
} {
  const bytes = transactionBytes(value)
  try {
    Transaction.fromAtomicBEEF(bytes)
    return { transaction: bytes as AtomicBEEF, format: 'atomic' }
  } catch {
    try {
      const atomic = Transaction.fromBEEF(bytes).toAtomicBEEF()
      Transaction.fromAtomicBEEF(atomic)
      return { transaction: atomic as AtomicBEEF, format: 'legacy-converted' }
    } catch {
      throw new InvalidPaymentTransactionError()
    }
  }
}
