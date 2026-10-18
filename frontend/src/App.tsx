import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { RequireAuth, RequirePermission } from './components/guards'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Search = lazy(() => import('./pages/Search'))
const Donations = lazy(() => import('./pages/Donations'))
const Inventory = lazy(() => import('./pages/Inventory'))
const LotForm = lazy(() => import('./pages/LotForm'))
const LotDetail = lazy(() => import('./pages/LotDetail'))
const Families = lazy(() => import('./pages/Families'))
const FamilyForm = lazy(() => import('./pages/FamilyForm'))
const FamilyDetail = lazy(() => import('./pages/FamilyDetail'))
const Deliveries = lazy(() => import('./pages/Deliveries'))
const RouteForm = lazy(() => import('./pages/RouteForm'))
const DeliveryForm = lazy(() => import('./pages/DeliveryForm'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Donors = lazy(() => import('./pages/Donors'))
const DonorForm = lazy(() => import('./pages/DonorForm'))
const DonorDetail = lazy(() => import('./pages/DonorDetail'))
const Reports = lazy(() => import('./pages/Reports'))
const Access = lazy(() => import('./pages/Access'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-600" role="status">Carregando…</p>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="busca" element={<Search />} />

            <Route element={<RequirePermission permission="donation:read" />}>
              <Route path="doacoes" element={<Donations />} />
            </Route>

            <Route element={<RequirePermission permission="stock:read" />}>
              <Route path="estoque" element={<Inventory />} />
              <Route path="estoque/:id" element={<LotDetail />} />
            </Route>
            <Route element={<RequirePermission permission="stock:write" />}>
              <Route path="cadastros" element={<Catalog />} />
              <Route path="estoque/novo" element={<LotForm />} />
            </Route>

            <Route element={<RequirePermission permission="family:read" />}>
              <Route path="familias" element={<Families />} />
              <Route path="familias/:id" element={<FamilyDetail />} />
            </Route>
            <Route element={<RequirePermission permission="family:write" />}>
              <Route path="familias/nova" element={<FamilyForm />} />
            </Route>

            <Route element={<RequirePermission permission="delivery:read" />}>
              <Route path="entregas" element={<Deliveries />} />
            </Route>
            <Route element={<RequirePermission permission="delivery:write" />}>
              <Route path="entregas/:id/nova" element={<DeliveryForm />} />
              <Route path="entregas/nova" element={<RouteForm />} />
            </Route>

            <Route element={<RequirePermission permission="donor:read" />}>
              <Route path="doadores" element={<Donors />} />
              <Route path="doadores/:id" element={<DonorDetail />} />
            </Route>
            <Route element={<RequirePermission permission="donor:write" />}>
              <Route path="doadores/novo" element={<DonorForm />} />
            </Route>

            <Route element={<RequirePermission permission="report:read" />}>
              <Route path="relatorios" element={<Reports />} />
            </Route>
            <Route element={<RequirePermission permission="access:read" />}>
              <Route path="acessos" element={<Access />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
