import { describe, expect, it } from 'vitest'
import { LockingScript, Transaction } from '@bsv/sdk'
import {
  InvalidPaymentTransactionError,
  normalizePaymentTransaction
} from './paymentTransaction'

const transaction = new Transaction()
transaction.addOutput({ satoshis: 1, lockingScript: LockingScript.fromHex('51') })

describe('normalizePaymentTransaction', () => {
  it('keeps valid AtomicBEEF unchanged', () => {
    const atomic = transaction.toAtomicBEEF()
    const normalized = normalizePaymentTransaction(atomic)

    expect(normalized.format).toBe('atomic')
    expect(normalized.transaction).toEqual(atomic)
    expect(() => Transaction.fromAtomicBEEF(normalized.transaction)).not.toThrow()
  })

  it('upgrades a valid legacy BEEF payload to AtomicBEEF', () => {
    const legacy = transaction.toBEEF()
    const normalized = normalizePaymentTransaction(new Uint8Array(legacy))

    expect(normalized.format).toBe('legacy-converted')
    expect(() => Transaction.fromAtomicBEEF(normalized.transaction)).not.toThrow()
  })

  it('rejects malformed transaction bytes', () => {
    expect(() => normalizePaymentTransaction([1, 2, 3])).toThrow(InvalidPaymentTransactionError)
    expect(() => normalizePaymentTransaction([1, 2, 300])).toThrow(InvalidPaymentTransactionError)
  })
})
