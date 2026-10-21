import { readAccount } from '../utils/account'
import { requireUser } from '../utils/session'

export default defineEventHandler(async event => readAccount(await requireUser(event)))
