import { describe, expect, it } from 'vitest'
import type { CreateActionResult, WalletInterface } from '@bsv/sdk'
import { normalizeCreateActionResult, withPortableCreateActionResults } from './walletCompatibility'

describe('normalizeCreateActionResult', () => {
  it('keeps historical number-array wallet results unchanged', () => {
    const result: CreateActionResult = { tx: [1, 2, 3] }

    expect(normalizeCreateActionResult(result)).toBe(result)
  })

  it('normalizes current Wallet Wire Uint8Array results for remittance and JSON transport', () => {
    const result: CreateActionResult = {
      tx: new Uint8Array([1, 2, 3]),
      signableTransaction: {
        tx: new Uint8Array([4, 5, 6]),
        reference: 'reference'
      }
    }

    const normalized = normalizeCreateActionResult(result)

    expect(normalized.tx).toEqual([1, 2, 3])
    expect(normalized.signableTransaction?.tx).toEqual([4, 5, 6])
    expect(JSON.parse(JSON.stringify(normalized.tx))).toEqual([1, 2, 3])
  })

  it('recovers direct and signable transactions mangled by historical JSON wallets', () => {
    const result = {
      tx: JSON.parse(JSON.stringify(new Uint8Array([1, 2, 3]))),
      signableTransaction: {
        tx: JSON.parse(JSON.stringify(new Uint8Array([4, 5, 6]))),
        reference: 'reference'
      }
    } as unknown as CreateActionResult

    const normalized = normalizeCreateActionResult(result)

    expect(normalized.tx).toEqual([1, 2, 3])
    expect(normalized.signableTransaction?.tx).toEqual([4, 5, 6])
  })

  it('does not silently turn sparse or malformed wallet payloads into empty transactions', () => {
    const malformed = { 0: 1, 2: 3 }
    const result = { tx: malformed } as unknown as CreateActionResult

    expect(normalizeCreateActionResult(result)).toBe(result)
    expect((normalizeCreateActionResult(result) as unknown as { tx: unknown }).tx).toBe(malformed)
  })

  it('normalizes createAction while preserving bound delegation through the wallet adapter', async () => {
    const base = {
      marker: 'wallet',
      async createAction(this: { marker: string }) {
        expect(this.marker).toBe('wallet')
        return { tx: new Uint8Array([7, 8, 9]) }
      },
      async getVersion(this: { marker: string }) {
        expect(this.marker).toBe('wallet')
        return { version: 'test-wallet' }
      }
    } as unknown as WalletInterface
    const wallet = withPortableCreateActionResults(base)

    expect((await wallet.createAction({ description: 'test' })).tx).toEqual([7, 8, 9])
    expect(await wallet.getVersion({})).toEqual({ version: 'test-wallet' })
  })
})
