import { Transaction, type AtomicBEEF } from '@bsv/sdk'
import { toPortableWalletBytes } from './byteArrayCompatibility'

export type PaymentTransactionFormat = 'atomic' | 'legacy-converted'

export class InvalidPaymentTransactionError extends Error {
  constructor() {
    super('This payment uses an invalid or unsupported transaction format.')
    this.name = 'InvalidPaymentTransactionError'
  }
}

function transactionBytes(value: unknown): number[] {
  const bytes = toPortableWalletBytes(value)
  if (bytes == null || bytes.length === 0) {
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
