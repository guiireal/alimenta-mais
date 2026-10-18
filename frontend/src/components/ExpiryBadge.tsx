import { Badge } from './ui'
import { EXPIRY_META, getExpiryStatus } from '../lib/utils'

export function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const meta = EXPIRY_META[getExpiryStatus(expiresAt)]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}
