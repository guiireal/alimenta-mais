export const config = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  /** Latência simulada do mock. Nos testes é zero para não atrasar a suíte. */
  mockLatencyMs: import.meta.env.MODE === 'test' ? 0 : Number(import.meta.env.VITE_MOCK_LATENCY ?? 350),
  sessionKey: 'alimenta:session',
  pageSize: 6,
} as const
