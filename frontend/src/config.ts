export const config = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  pageSize: 6,
} as const
