import type { DeliveryRoute, DeliveryStatus, RouteInput, RouteStop } from '../types'
import { ApiError, db, logAudit, nextId, nowIso, simulate } from './db'

const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const listRoutes = (): Promise<DeliveryRoute[]> => simulate(() => db.routes)

export const createRoute = (input: RouteInput): Promise<DeliveryRoute> =>
  simulate(() => {
    const families = input.familyIds.map((id) => {
      const family = db.families.find((f) => f.id === id)
      if (!family) throw new ApiError('Família não encontrada.', 404)
      if (family.consent !== 'granted') throw new ApiError(`A família ${family.code} ainda não tem consentimento LGPD.`, 422)
      return family
    })
    if (families.length === 0) throw new ApiError('Escolha ao menos uma família.', 422)

    const stops: RouteStop[] = families.map((family, i) => ({
      id: `S-${Date.now()}-${i}`,
      order: i + 1,
      destination: `Família ${family.code}`,
      familyId: family.id,
      items: 'Cesta básica',
      eta: addMinutes(input.startTime, 40 * (i + 1)),
      status: 'waiting',
      x: 22 + ((i * 41) % 66),
      y: 24 + ((i * 29) % 52),
    }))
    const route: DeliveryRoute = {
      id: nextId('R', db.routes.map((r) => r.id), 2),
      name: input.name.trim(),
      driver: input.driver,
      vehicle: input.vehicle,
      depot: { x: 10, y: 30 + ((db.routes.length * 17) % 40) },
      stops,
    }
    db.routes.push(route)
    logAudit('Rota gerada', route.id)
    return route
  })

const NEXT: Record<DeliveryStatus, DeliveryStatus | null> = { waiting: 'en_route', en_route: 'delivered', delivered: null }

/** Avança a parada: aguardando, em rota, entregue. A entrega confirmada atualiza a família. */
export const advanceStop = (routeId: string, stopId: string): Promise<DeliveryRoute> =>
  simulate(() => {
    const route = db.routes.find((r) => r.id === routeId)
    const stop = route?.stops.find((s) => s.id === stopId)
    if (!route || !stop) throw new ApiError('Parada não encontrada.', 404)
    const next = NEXT[stop.status]
    if (!next) throw new ApiError('Esta entrega já foi concluída.', 409)
    stop.status = next
    if (next === 'delivered' && stop.familyId) {
      const family = db.families.find((f) => f.id === stop.familyId)
      if (family) family.lastDeliveryAt = nowIso()
    }
    logAudit(next === 'delivered' ? 'Entrega confirmada' : 'Entrega iniciada', `${route.id}, parada ${stop.order}`)
    return route
  })
