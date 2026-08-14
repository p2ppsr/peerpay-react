import type { IncomingPayment } from '@bsv/message-box-client'
import { peerPayClient } from './peerPayClient'
import { normalizePaymentTransaction, type PaymentTransactionFormat } from './paymentTransaction'

export { InvalidPaymentTransactionError, normalizePaymentTransaction } from './paymentTransaction'
export type { PaymentTransactionFormat } from './paymentTransaction'

export function prepareIncomingPayment(payment: IncomingPayment): {
  payment: IncomingPayment
  format: PaymentTransactionFormat
} {
  const normalized = normalizePaymentTransaction(payment.token.transaction)
  return {
    format: normalized.format,
    payment: {
      ...payment,
      token: {
        ...payment.token,
        transaction: normalized.transaction
      }
    }
  }
}

function assertPaymentAccepted(result: unknown): void {
  if (typeof result === 'string' || result == null || typeof result !== 'object') {
    throw new Error(typeof result === 'string' ? result : 'The wallet did not confirm the payment.')
  }
}

export async function acceptIncomingPayment(payment: IncomingPayment): Promise<PaymentTransactionFormat> {
  const prepared = prepareIncomingPayment(payment)
  const result = await peerPayClient.acceptPayment(prepared.payment)
  assertPaymentAccepted(result)
  return prepared.format
}

export async function rejectIncomingPayment(payment: IncomingPayment): Promise<PaymentTransactionFormat> {
  const prepared = prepareIncomingPayment(payment)
  const amount = prepared.payment.token.amount
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('The payment amount is invalid.')

  // Tiny payments cannot cover the library's refund fee, so rejecting only
  // acknowledges them. Larger payments must be accepted successfully before
  // refunding; the upstream rejectPayment method does not currently enforce
  // that result and could otherwise refund from unrelated wallet funds.
  if (amount - 1_000 < 1_000) {
    await peerPayClient.rejectPayment(prepared.payment)
  } else {
    const result = await peerPayClient.acceptPayment(prepared.payment)
    assertPaymentAccepted(result)
    await peerPayClient.sendPayment({ recipient: prepared.payment.sender, amount: amount - 1_000 })
  }
  return prepared.format
}
