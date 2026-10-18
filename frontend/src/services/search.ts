import type { Donation, Donor, Family, StockLot } from '../types'
import { http, type Page } from './http'
import { lotFromAPI, type InventoryDTO } from './stock'
import { donorFromAPI, donationFromAPI, type DonorDTO, type DonationDTO } from './donations'
import { familyFromAPI, type FamilyDTO } from './families'
export interface SearchScope { stock: boolean; donors: boolean; families: boolean; donations: boolean }
export interface SearchResults { lots: StockLot[]; donors: Donor[]; families: Family[]; donations: Donation[] }
export const MIN_QUERY_LENGTH = 2
export async function searchAll(q: string, scope: SearchScope): Promise<SearchResults> {
  const params = { q, page_size: 8 }
  const [lots, donors, families, donations] = await Promise.all([
    scope.stock ? http.get<Page<InventoryDTO>>('/inventory', params).then((p) => p.items.map(lotFromAPI)) : [],
    scope.donors ? http.get<Page<DonorDTO>>('/overview/donors', params).then((p) => p.items.map(donorFromAPI)) : [],
    scope.families ? http.get<Page<FamilyDTO>>('/overview/families', params).then((p) => p.items.map(familyFromAPI)) : [],
    scope.donations ? http.get<Page<DonationDTO>>('/overview/donations', params).then((p) => p.items.map(donationFromAPI)) : [],
  ])
  return { lots, donors, families, donations }
}
