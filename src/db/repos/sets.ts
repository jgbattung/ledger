import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { Set as SetRecord } from '@/db/types'

export const sets = createRepo<SetRecord>(db.sets, 'sets')
