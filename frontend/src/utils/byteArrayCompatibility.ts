const hasOwn = Object.prototype.hasOwnProperty

function isByte(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 255
}

function isUint8Array(value: unknown): value is Uint8Array {
  if (value == null || typeof value !== 'object' || typeof ArrayBuffer === 'undefined') return false
  return ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]'
}

/**
 * Return the portable byte-array representation accepted by historical and
 * current BRC-100 consumers. Valid number arrays stay on the zero-copy path;
 * typed arrays and the numeric-key objects produced by old JSON wallet bridges
 * are copied once. Sparse and non-byte inputs are rejected.
 */
export function toPortableWalletBytes(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!hasOwn.call(value, i) || !isByte(value[i])) return undefined
    }
    return value
  }

  if (isUint8Array(value)) return Array.from(value)

  if (
    value == null ||
    typeof value !== 'object' ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value))
  ) return undefined

  const keys = Object.keys(value)
  const bytes = new Array<number>(keys.length)
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== String(i)) return undefined
    const byte = (value as Record<string, unknown>)[keys[i]]
    if (!isByte(byte)) return undefined
    bytes[i] = byte
  }
  return bytes
}
