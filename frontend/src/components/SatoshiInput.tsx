import React, { useState } from 'react'
import { InputAdornment, TextField } from '@mui/material'

interface SatoshiInputProps {
  onSatoshisChange: (amount: number | null) => void
}

export function parseSatoshiInput(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

const SatoshiInput: React.FC<SatoshiInputProps> = ({ onSatoshisChange }) => {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setValue(next)
    if (next === '') {
      setInvalid(false)
      onSatoshisChange(null)
      return
    }
    const amount = parseSatoshiInput(next)
    setInvalid(amount === null)
    onSatoshisChange(amount)
  }

  return (
    <TextField
      label='Enter Amount'
      value={value}
      onChange={handleChange}
      error={invalid}
      helperText={invalid ? 'Enter a positive whole number of satoshis.' : undefined}
      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1, step: 1 }}
      InputProps={{ endAdornment: <InputAdornment position='end'>sats</InputAdornment> }}
      fullWidth
    />
  )
}

export default SatoshiInput
