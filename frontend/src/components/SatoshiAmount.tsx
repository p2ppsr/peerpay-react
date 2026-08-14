import React from 'react'
import { Typography } from '@mui/material'

interface SatoshiAmountProps {
  amount: number
}

export function formatSatoshis(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) return 'Invalid amount'
  return `${amount.toLocaleString()} ${amount === 1 ? 'sat' : 'sats'}`
}

const SatoshiAmount: React.FC<SatoshiAmountProps> = ({ amount }) => (
  <Typography component='span'>{formatSatoshis(amount)}</Typography>
)

export default SatoshiAmount
