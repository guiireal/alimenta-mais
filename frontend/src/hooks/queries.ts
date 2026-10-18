import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as access from '../services/access'
import * as dashboard from '../services/dashboard'
import * as deliveries from '../services/deliveries'
import * as donations from '../services/donations'
import * as families from '../services/families'
import * as searchService from '../services/search'
import * as stock from '../services/stock'
import * as catalog from '../services/catalog'
import type { ConsentStatus, LotQuery, Role, RouteStatus } from '../types'

/** Shared query keys keep reads synchronized after server mutations. */
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
    mutationFn: stock.transferLot,
    onSuccess: () => refresh(qc, ...STOCK_ROOTS),
  })
}
export const useDisposeLot = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: stock.disposeLot,
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
    mutationFn: (v: { routeId: string; stopId: string; status: 'waiting' | 'en_route' }) => deliveries.advanceStop(v.routeId, v.stopId, v.status),
    onSuccess: () => refresh(qc, 'routes', 'dashboard', 'families', 'family'),
  })
}

/* ---------- painéis, busca e acesso ---------- */
export const useDashboard = (enabled = true) => useQuery({ queryKey: ['dashboard'], queryFn: dashboard.getDashboard, enabled })
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
    mutationFn: (v: { id: string; patch: { role: Role; active: boolean } }) => access.updateUser(v.id, v.patch),
    onSuccess: () => refresh(qc, 'users'),
  })
}

/** Exportação: busca todos os lotes do filtro atual, sem paginação. */
export const useExportLots = () =>
  useMutation({ mutationFn: stock.exportLots })

export const useCatalog = () => useQuery({ queryKey: ['catalog'], queryFn: catalog.getCatalog })
export const useCreateCategory = () => { const qc = useQueryClient(); return useMutation({ mutationFn: catalog.createCategory, onSuccess: () => refresh(qc, 'catalog') }) }
export const useCreateProduct = () => { const qc = useQueryClient(); return useMutation({ mutationFn: catalog.createProduct, onSuccess: () => refresh(qc, 'catalog') }) }
export const useCreateWarehouse = () => { const qc = useQueryClient(); return useMutation({ mutationFn: catalog.createWarehouse, onSuccess: () => refresh(qc, 'catalog') }) }
export const useDonation = (id: string) => useQuery({ queryKey: ['donation', id], queryFn: () => donations.getDonation(id), enabled: Boolean(id) })
export const useTriageBatch = () => { const qc = useQueryClient(); return useMutation({ mutationFn: donations.triageBatch, onSuccess: () => refresh(qc, 'donation', 'donations', ...STOCK_ROOTS) }) }
export const useConfirmDonation = () => { const qc = useQueryClient(); return useMutation({ mutationFn: donations.confirmDonation, onSuccess: () => refresh(qc, 'donation', 'donations', ...STOCK_ROOTS) }) }
export const useSetRouteStatus = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (v: { id: string; status: RouteStatus }) => deliveries.setRouteStatus(v.id, v.status), onSuccess: () => refresh(qc, 'routes') }) }
export const useCreateDelivery = () => { const qc = useQueryClient(); return useMutation({ mutationFn: deliveries.createDelivery, onSuccess: () => refresh(qc, 'routes', ...STOCK_ROOTS) }) }
