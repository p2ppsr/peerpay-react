import type { AtomicBEEF, CreateActionResult, WalletInterface } from '@bsv/sdk'

function portableAtomicBeef(value: AtomicBEEF | undefined): AtomicBEEF | undefined {
  return value instanceof Uint8Array ? Array.from(value) : value
}

/**
 * Wallet Wire returns binary transaction fields as Uint8Array, while some
 * payment libraries and JSON message transports still require number[]. Keep
 * that representation mismatch at the wallet boundary so the rest of PeerPay
 * behaves consistently across historical JSON wallets and current binary-wire
 * wallets.
 */
export function normalizeCreateActionResult(result: CreateActionResult): CreateActionResult {
  const tx = portableAtomicBeef(result.tx)
  const signableTx = portableAtomicBeef(result.signableTransaction?.tx)

  if (tx === result.tx && signableTx === result.signableTransaction?.tx) return result

  return {
    ...result,
    tx,
    signableTransaction: result.signableTransaction == null
      ? undefined
      : {
          ...result.signableTransaction,
          tx: signableTx!
        }
  }
}

export function withPortableCreateActionResults(wallet: WalletInterface): WalletInterface {
  return new Proxy(wallet, {
    get(target, property, receiver) {
      if (property === 'createAction') {
        return async (...args: Parameters<WalletInterface['createAction']>) => {
          const result = await target.createAction(...args)
          return normalizeCreateActionResult(result)
        }
      }

      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}
