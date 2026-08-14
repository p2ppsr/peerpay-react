import { describe, expect, it } from 'vitest'
import { amountBand, sanitizeTelemetryContext, sanitizeTelemetryText } from './telemetry'

describe('telemetry privacy', () => {
  it('redacts payment and identity material by key', () => {
    expect(sanitizeTelemetryContext({
      transaction: [1, 2, 3],
      recipientIdentityKey: '02abcdef',
      outcome: 'failed'
    })).toEqual({
      transaction: '[redacted]',
      recipientIdentityKey: '[redacted]',
      outcome: 'failed'
    })
  })

  it('redacts sensitive-shaped values and local usernames', () => {
    const text = sanitizeTelemetryText(
      'ty@example.com /Users/tyeverett/file 0123456789abcdef0123456789abcdef'
    )
    expect(text).toBe('[email] /Users/[user]/file [hex]')
  })

  it('buckets payment values instead of reporting exact amounts', () => {
    expect(amountBand(1)).toBe('1-9')
    expect(amountBand(999)).toBe('100-999')
    expect(amountBand(100_000)).toBe('100000-plus')
  })
})
