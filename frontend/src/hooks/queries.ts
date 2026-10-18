import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as access from '../services/access'
import * as dashboard from '../services/dashboard'
import * as deliveries from '../services/deliveries'
import * as donations from '../services/donations'
import * as families from '../services/families'
import * as searchService from '../services/search'
import * as stock from '../services/stock'
import type { ConsentStatus, DisposalReason, LotQuery, Role, Warehouse } from '../types'

/**
 * Todas as leituras e escritas passam por aqui. As telas não conhecem o service:
 * se a origem dos dados mudar (mock para API), só os services são alterados.
 */
const refresh = (qc: QueryClient, ...roots: string[]) =>
  Promise.all([...roots, 'audit'].map((root) => qc.invalidateQueries({ queryKey: [root] })))

const STOCK_ROOTS = ['lots', 'lot', 'stock-stats', 'dashboard', 'search']

/* ---------- estoque ---------- */
export const useLots = (query: LotQuery, enabled = true) =>
  useQuery({ queryKey: ['lots', query], queryFn: () => stock.listLots(query), placeholderData: keepPreviousData, enabled })
export const useStockStats = (enabled = true) => useQuery({ queryKey: ['stock-stats'], queryFn: stock.getStockStats, enabled })
export const useLot = (id: string) => useQuery({ queryKey: ['lot', id], queryFn: () => stock.getLot(id) })

export const useCreateLot = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: stock.createLot, onSuccess: () => refresh(qc, ...STOCK_ROOTS) })
}
export const useTransferLot = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; warehouse: Warehouse }) => stock.transferLot(v.id, v.warehouse),
    onSuccess: () => refresh(qc, ...STOCK_ROOTS),
  })
}
export const useDisposeLot = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; reason: DisposalReason }) => stock.disposeLot(v.id, v.reason),
    onSuccess: () => refresh(qc, ...STOCK_ROOTS),
  })
}

/* ---------- doações e doadores ---------- */
export const useDonations = () => useQuery({ queryKey: ['donations'], queryFn: donations.listDonations })
export const useCreateDonation = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: donations.createDonation, onSuccess: () => refresh(qc, ...STOCK_ROOTS, 'donations', 'donors', 'donor') })
}
export const useDonors = (q = '') => useQuery({ queryKey: ['donors', q], queryFn: () => donations.listDonors(q), placeholderData: keepPreviousData })
export const useDonor = (id: string) => useQuery({ queryKey: ['donor', id], queryFn: () => donations.getDonor(id) })
export const useCreateDonor = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: donations.createDonor, onSuccess: () => refresh(qc, 'donors', 'search') })
}

/* ---------- famílias ---------- */
export const useFamilies = (params: { q?: string; consent?: ConsentStatus | 'all' } = {}, enabled = true) =>
  useQuery({ queryKey: ['families', params], queryFn: () => families.listFamilies(params), placeholderData: keepPreviousData, enabled })
export const useFamily = (id: string) => useQuery({ queryKey: ['family', id], queryFn: () => families.getFamily(id) })
export const useCreateFamily = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: families.createFamily, onSuccess: () => refresh(qc, 'families', 'family', 'search') })
}
export const useSetConsent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; granted: boolean }) => families.setConsent(v.id, v.granted),
    onSuccess: () => refresh(qc, 'families', 'family'),
  })
}

/* ---------- entregas ---------- */
export const useRoutes = () => useQuery({ queryKey: ['routes'], queryFn: deliveries.listRoutes })
export const useCreateRoute = () => {
  const qc = useQueryClient()
  return useMutation({ mutationFn: deliveries.createRoute, onSuccess: () => refresh(qc, 'routes', 'dashboard') })
}
export const useAdvanceStop = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { routeId: string; stopId: string }) => deliveries.advanceStop(v.routeId, v.stopId),
    onSuccess: () => refresh(qc, 'routes', 'dashboard', 'families', 'family'),
  })
}

/* ---------- painéis, busca e acesso ---------- */
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: dashboard.getDashboard })
export const useReports = (months: number) =>
  useQuery({ queryKey: ['reports', months], queryFn: () => dashboard.getReports(months), placeholderData: keepPreviousData })

export const useSearch = (q: string, scope: searchService.SearchScope) =>
  useQuery({
    queryKey: ['search', q.trim().toLowerCase(), scope],
    queryFn: () => searchService.searchAll(q, scope),
    enabled: q.trim().length >= searchService.MIN_QUERY_LENGTH,
  })

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: access.listUsers })
export const useAudit = () => useQuery({ queryKey: ['audit'], queryFn: access.listAudit })
export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; patch: { role?: Role; active?: boolean }; actorId: string }) => access.updateUser(v.id, v.patch, v.actorId),
    onSuccess: () => refresh(qc, 'users'),
  })
}

/** Exportação: busca todos os lotes do filtro atual, sem paginação. */
export const useExportLots = () =>
  useMutation({ mutationFn: (query: LotQuery) => stock.listLots({ ...query, page: 1, pageSize: 1000 }) })
