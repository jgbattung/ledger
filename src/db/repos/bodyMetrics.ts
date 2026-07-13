import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { BodyMetric } from '@/db/types'

export const bodyMetrics = createRepo<BodyMetric>(db.bodyMetrics, 'bodyMetrics')
