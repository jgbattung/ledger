import { db } from '@/db/ledger'
import { createRepo } from '@/db/repos/base'
import type { Photo } from '@/db/types'

export const photos = createRepo<Photo>(db.photos, 'photos')
