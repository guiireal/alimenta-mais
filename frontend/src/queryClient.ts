import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './services/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // erros 4xx são respostas definitivas (não encontrado, sem permissão); só falhas de rede e 5xx merecem nova tentativa
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})
