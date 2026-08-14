import { describe, expect, it } from 'vitest'
import { Beef, LockingScript, Transaction } from '@bsv/sdk'
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

  it('recovers the numeric-key object emitted when a wallet JSON-serializes Uint8Array', () => {
    const atomic = transaction.toAtomicBEEF()
    const jsonTransport = JSON.parse(JSON.stringify(new Uint8Array(atomic)))

    const normalized = normalizePaymentTransaction(jsonTransport)

    expect(normalized.format).toBe('atomic')
    expect(normalized.transaction).toEqual(atomic)
  })

  it('prunes unrelated historical BEEF branches from an AtomicBEEF envelope', () => {
    const dependency = new Transaction()
    dependency.addOutput({ satoshis: 2, lockingScript: LockingScript.fromHex('51') })

    const subject = new Transaction()
    subject.addInput({
      sourceTransaction: dependency,
      sourceOutputIndex: 0,
      unlockingScript: LockingScript.fromHex('51')
    })
    subject.addOutput({ satoshis: 1, lockingScript: LockingScript.fromHex('51') })

    const unrelated = new Transaction()
    unrelated.addOutput({ satoshis: 1, lockingScript: LockingScript.fromHex('51') })

    const beef = new Beef()
    beef.mergeTransaction(dependency)
    beef.mergeTransaction(subject)
    beef.mergeTransaction(unrelated)

    const legacyEnvelope = [
      ...beef.toBinaryAtomic(subject.id('hex')).slice(0, 36),
      ...beef.toBinary()
    ]
    expect(() => Transaction.fromAtomicBEEF(legacyEnvelope)).toThrow('unrelated transaction data')

    const normalized = normalizePaymentTransaction(legacyEnvelope)

    expect(normalized.format).toBe('legacy-converted')
    expect(Transaction.fromAtomicBEEF(normalized.transaction).id('hex')).toBe(subject.id('hex'))
    expect(normalized.transaction.length).toBeLessThan(legacyEnvelope.length)
  })

  it('rejects malformed transaction bytes', () => {
    expect(() => normalizePaymentTransaction([1, 2, 3])).toThrow(InvalidPaymentTransactionError)
    expect(() => normalizePaymentTransaction([1, 2, 300])).toThrow(InvalidPaymentTransactionError)
    expect(() => normalizePaymentTransaction([1, , 3])).toThrow(InvalidPaymentTransactionError)
    expect(() => normalizePaymentTransaction({ 0: 1, 2: 3 })).toThrow(InvalidPaymentTransactionError)
  })
})
