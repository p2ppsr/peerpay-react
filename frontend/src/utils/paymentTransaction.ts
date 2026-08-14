import { Transaction, type AtomicBEEF } from '@bsv/sdk'

export type PaymentTransactionFormat = 'atomic' | 'legacy-converted'

export class InvalidPaymentTransactionError extends Error {
  constructor() {
    super('This payment uses an invalid or unsupported transaction format.')
    this.name = 'InvalidPaymentTransactionError'
  }
}

function transactionBytes(value: unknown): number[] {
  const bytes = value instanceof Uint8Array ? Array.from(value) : value
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
