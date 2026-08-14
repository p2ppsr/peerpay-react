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
