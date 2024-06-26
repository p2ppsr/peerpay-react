import React, { } from 'react'
import { List, ListItem, ListItemText, Button, ListItemSecondaryAction, useTheme, Box, Divider } from '@mui/material'
import { IdentityCard } from 'metanet-identity-react'
import { AmountDisplay } from 'amountinator-react'
import constants from '../utils/constants'

export interface Payment {
  messageId: string
  sender: string
  amount: string
  token: Token
}

interface Token {
  amount: number,
  derivationPrefix: string,
  transaction: object
}

interface PaymentListProps {
  payments: Payment[]
  onAccept: (payment: Payment) => void
  onReject: (payment: Payment) => void
}

const PaymentList: React.FC<PaymentListProps> = ({ payments, onAccept, onReject }) => {
  const theme = useTheme()
  return (
    <List>
      {payments.map(payment => (
        <Box key={payment.messageId}>
          <Divider />
          <ListItem>
            <IdentityCard
              confederacyHost={constants.confederacyURL}
              identityKey={payment.sender}
              themeMode='dark'
            />
            <ListItemText>
              <AmountDisplay paymentAmount={payment.token.amount}>
              </AmountDisplay>
            </ListItemText>
            <ListItemSecondaryAction>
              <Button onClick={() => onAccept(payment)} color='primary'>Accept</Button>
              <Button onClick={() => onReject(payment)} color='secondary'>Reject</Button>
            </ListItemSecondaryAction>
          </ListItem>
        </Box>
      ))}
    </List>
  )
}

export default PaymentList
