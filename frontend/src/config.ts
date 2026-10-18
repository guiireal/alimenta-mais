export const config = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1',
  pageSize: 6,
} as const
