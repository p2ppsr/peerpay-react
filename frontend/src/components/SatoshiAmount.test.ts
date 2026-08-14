import { describe, expect, it } from 'vitest'
import { formatSatoshis } from './SatoshiAmount'
import { parseSatoshiInput } from './SatoshiInput'

describe('formatSatoshis', () => {
  it('formats whole satoshi amounts without a remote exchange rate', () => {
    expect(formatSatoshis(1)).toBe('1 sat')
    expect(formatSatoshis(12_345)).toBe('12,345 sats')
  })

  it('rejects unsafe, fractional, and negative values', () => {
    expect(formatSatoshis(1.5)).toBe('Invalid amount')
    expect(formatSatoshis(-1)).toBe('Invalid amount')
    expect(formatSatoshis(Number.MAX_SAFE_INTEGER + 1)).toBe('Invalid amount')
  })
})

describe('parseSatoshiInput', () => {
  it('accepts only positive safe integers', () => {
    expect(parseSatoshiInput('1234')).toBe(1234)
    expect(parseSatoshiInput('12.34')).toBeNull()
    expect(parseSatoshiInput('12abc')).toBeNull()
    expect(parseSatoshiInput('0')).toBeNull()
    expect(parseSatoshiInput('9007199254740992')).toBeNull()
  })
})
