import packageJson from '../../package.json'

const USERCOM_ENDPOINT = 'https://usercom.babbage.systems/signals'
const SOURCE = 'peerpay'
const ANONYMOUS_ID_KEY = 'peerpay:telemetry-anonymous-id:v1'
const QUEUE_KEY = 'peerpay:telemetry-queue:v1'
const MAX_QUEUE_SIZE = 80
const MAX_BATCH_SIZE = 20
const FLUSH_DELAY_MS = 750
const RETRY_DELAY_MS = 15_000
const REQUEST_TIMEOUT_MS = 4_000
const ERROR_DEDUPE_MS = 30_000
const SENSITIVE_KEY = /(address|beef|certificate|credential|email|identity|key|message.?id|mnemonic|password|payload|phone|private|proof|recipient|request|response|secret|seed|sender|signature|token|transaction|txid|wallet)/i

export type TelemetrySeverity = 'info' | 'warn' | 'error' | 'fatal'

type TelemetryOptions = {
  surface?: string
  severity?: TelemetrySeverity
  tags?: string[]
  context?: Record<string, unknown>
}

type UsercomSignal = {
  source: string
  name: string
  surface: string
  url: string
  path: string
  anonymousId: string
  sessionId: string
  tags: string[]
  context: Record<string, unknown>
}

const sessionId = createId('session')
const recentErrors = new Map<string, number>()
let queue: UsercomSignal[] = loadQueue()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let flushInFlight = false
let initialized = false

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function anonymousId(): string {
  const store = storage()
  try {
    const existing = store?.getItem(ANONYMOUS_ID_KEY)
    if (existing) return existing
    const next = createId('install')
    store?.setItem(ANONYMOUS_ID_KEY, next)
    return next
  } catch {
    return createId('install')
  }
}

function loadQueue(): UsercomSignal[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : []
  } catch {
    return []
  }
}

function persistQueue(): void {
  try {
    if (queue.length === 0) storage()?.removeItem(QUEUE_KEY)
    else storage()?.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)))
  } catch {
    // Telemetry must never interfere with payments.
  }
}

function cleanName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 128)
  return cleaned || 'app.event'
}

function cleanTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

export function sanitizeTelemetryText(value: string, maxLength = 500): string {
  return value
    .replace(/([?&][^=\s]+)=([^&#\s]*)/g, '$1=[redacted]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[hex]')
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,}\b/g, '[encoded]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\/Users\/[^/\s]+/g, '/Users/[user]')
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, 'C:\\Users\\[user]')
    .slice(0, maxLength)
}

function cleanValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null || value === '') return undefined
  if (depth > 3) return '[truncated]'
  if (typeof value === 'string') return sanitizeTelemetryText(value)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => cleanValue(item, depth + 1)).filter(item => item !== undefined)
  }
  if (typeof value === 'object') return sanitizeTelemetryContext(value as Record<string, unknown>, depth + 1)
  return sanitizeTelemetryText(String(value), 200)
}

export function sanitizeTelemetryContext(
  context: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [rawKey, rawValue] of Object.entries(context).slice(0, 40)) {
    const key = rawKey.replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 80)
    if (!key) continue
    const value = SENSITIVE_KEY.test(key) ? '[redacted]' : cleanValue(rawValue, depth)
    if (value !== undefined && value !== null && value !== '') safe[key] = value
  }
  return safe
}

function safeError(error: unknown): { message: string; errorName?: string; frames?: string[] } {
  const err = error instanceof Error ? error : undefined
  const message = sanitizeTelemetryText(err?.message ?? String(error))
  const frames = err?.stack
    ?.split('\n')
    .slice(1)
    .flatMap(line => {
      const match = line.match(/(?:^|[/\\])([^/\\()\s?#]+):(\d+):(\d+)\)?$/)
      return match ? [`${match[1]}:${match[2]}:${match[3]}`] : []
    })
    .slice(0, 8)
  return {
    message,
    ...(err?.name ? { errorName: sanitizeTelemetryText(err.name, 80) } : {}),
    ...(frames?.length ? { frames } : {})
  }
}

function enqueue(signal: UsercomSignal): void {
  queue.push(signal)
  queue = queue.slice(-MAX_QUEUE_SIZE)
  persistQueue()
  if (queue.length >= MAX_BATCH_SIZE) void flush()
  else scheduleFlush(FLUSH_DELAY_MS)
}

function scheduleFlush(delay: number): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), delay)
}

function requeue(batch: UsercomSignal[]): void {
  queue = [...batch, ...queue].slice(0, MAX_QUEUE_SIZE)
  persistQueue()
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => void flush(), RETRY_DELAY_MS)
}

export async function flush(useBeacon = false): Promise<void> {
  if (flushInFlight || queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH_SIZE)
  persistQueue()
  const body = JSON.stringify({ events: batch })

  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    if (!navigator.sendBeacon(USERCOM_ENDPOINT, new Blob([body], { type: 'application/json' }))) requeue(batch)
    return
  }

  flushInFlight = true
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(USERCOM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      signal: controller.signal
    })
    if (!response.ok) requeue(batch)
  } catch {
    requeue(batch)
  } finally {
    clearTimeout(timeout)
    flushInFlight = false
    if (queue.length > 0) scheduleFlush(FLUSH_DELAY_MS)
  }
}

export function reportTelemetryEvent(name: string, options: TelemetryOptions = {}): void {
  if (typeof window === 'undefined') return
  const severity = options.severity ?? 'info'
  const path = window.location.pathname
  enqueue({
    source: SOURCE,
    name: cleanName(name),
    surface: options.surface ?? 'app',
    url: `${window.location.origin}${path}`,
    path,
    anonymousId: anonymousId(),
    sessionId,
    tags: Array.from(new Set([
      `release:${cleanTag(packageJson.version)}`,
      `severity:${severity}`,
      ...(options.tags ?? []).map(cleanTag).filter(Boolean)
    ])).slice(0, 32),
    context: sanitizeTelemetryContext({
      releaseVersion: packageJson.version,
      severity,
      occurredAt: new Date().toISOString(),
      online: navigator.onLine,
      ...options.context
    })
  })
}

export function reportTelemetryError(name: string, error: unknown, options: TelemetryOptions = {}): void {
  const details = safeError(error)
  const fingerprint = `${cleanName(name)}:${details.errorName ?? ''}:${details.message}`
  const now = Date.now()
  const previous = recentErrors.get(fingerprint)
  if (previous !== undefined && now - previous < ERROR_DEDUPE_MS) return
  recentErrors.set(fingerprint, now)
  reportTelemetryEvent(name, {
    ...options,
    severity: options.severity ?? 'error',
    context: { ...details, ...options.context }
  })
}

export function amountBand(amount: number): string {
  if (amount < 10) return '1-9'
  if (amount < 100) return '10-99'
  if (amount < 1_000) return '100-999'
  if (amount < 10_000) return '1000-9999'
  if (amount < 100_000) return '10000-99999'
  return '100000-plus'
}

export function initTelemetry(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  window.addEventListener('error', event => {
    reportTelemetryError('app.unhandled_error', event.error ?? event.message, {
      surface: 'runtime',
      context: { sourceFile: event.filename?.split('/').pop(), line: event.lineno, column: event.colno }
    })
  })
  window.addEventListener('unhandledrejection', event => {
    reportTelemetryError('app.unhandled_rejection', event.reason, { surface: 'runtime' })
  })
  window.addEventListener('pagehide', () => void flush(true))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true)
  })
  reportTelemetryEvent('app.loaded', { surface: 'lifecycle' })
}
