import { finishRequestLog, startRequestLog } from '../utils/request-logging'

export default defineNitroPlugin(nitro => {
  if (process.env.REQUEST_LOGGING_ENABLED !== 'true') return
  nitro.hooks.hook('request', startRequestLog)
  nitro.hooks.hook('afterResponse', event => finishRequestLog(event))
})
