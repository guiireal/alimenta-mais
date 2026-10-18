import type { DeliveryRoute, RouteInput, RouteStatus } from '../types'
import { allPages, http } from './http'
export interface RouteDTO {
  id: number; reference_code: string; origin_warehouse_id: number; warehouse_name: string; scheduled_on: string; status: RouteStatus; assigned_name: string
  stops: { id: number; family_id: number | null; stop_sequence: number | null; destination_address: string; description: string | null; scheduled_at: string | null; status: 'waiting' | 'in_transit' | 'delivered' | 'failed' | 'cancelled' }[]
}
export const routeFromAPI = (r: RouteDTO): DeliveryRoute => ({
  id: String(r.id), name: r.reference_code, driver: r.assigned_name || 'Sem responsável', warehouse: r.warehouse_name,
  warehouseId: String(r.origin_warehouse_id), scheduledOn: r.scheduled_on, status: r.status,
  stops: r.stops.map((s) => ({ id: String(s.id), order: s.stop_sequence ?? 0, familyId: s.family_id ? String(s.family_id) : undefined,
    destination: s.destination_address, items: s.description ?? 'Consultar itens da entrega',
    eta: s.scheduled_at ? new Date(s.scheduled_at).toLocaleString('pt-BR') : 'Não informada', status: s.status === 'in_transit' ? 'en_route' : s.status,
  })),
})
export const listRoutes = async (): Promise<DeliveryRoute[]> => (await allPages<RouteDTO>('/overview/routes')).map(routeFromAPI)
export async function createRoute(input: RouteInput): Promise<{ id: string; name: string }> {
  const route = await http.post<{ id: number; reference_code: string }>('/routes', {
    reference_code: input.name, origin_warehouse_id: Number(input.warehouseId), scheduled_on: input.scheduledOn, assigned_to: input.assignedTo ? Number(input.assignedTo) : null,
  })
  return { id: String(route.id), name: route.reference_code }
}
export async function advanceStop(_routeId: string, stopId: string, status: 'waiting' | 'en_route') {
  if (status === 'waiting') await http.post('/deliveries/' + stopId + '/dispatch')
  else await http.put('/deliveries/' + stopId + '/status', { status: 'delivered' })
}
export const setRouteStatus = (id: string, status: RouteStatus) => http.put('/routes/' + id + '/status', { status })
export interface DeliveryInput { routeId: string; warehouseId: string; familyId: string; address: string; order: string; description: string; items: { productId: string; quantity: string }[] }
export const createDelivery = (input: DeliveryInput) => http.post('/deliveries', {
  route_id: Number(input.routeId), source_warehouse_id: Number(input.warehouseId), family_id: Number(input.familyId),
  destination_address: input.address, stop_sequence: Number(input.order), description: input.description || null,
  items: input.items.map((i) => ({ product_id: Number(i.productId), quantity: i.quantity.trim().replace(',', '.') })),
})
