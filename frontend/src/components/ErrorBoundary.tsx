import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import { reportTelemetryError } from '../utils/telemetry'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    reportTelemetryError('app.react_crash', error, {
      surface: 'react',
      severity: 'fatal',
      context: { componentStack: info.componentStack }
    })
  }

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
        <Paper className='peerpay-panel' sx={{ p: 3, maxWidth: 440, textAlign: 'center' }}>
          <Typography variant='h5' sx={{ mb: 1 }}>PeerPay hit an unexpected error</Typography>
          <Typography color='text.secondary' sx={{ mb: 2 }}>
            A privacy-safe crash report was sent. Reload PeerPay to try again.
          </Typography>
          <Button variant='contained' onClick={() => window.location.reload()}>Reload PeerPay</Button>
        </Paper>
      </Box>
    )
  }
}

export default ErrorBoundary
