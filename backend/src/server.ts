import { app } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

app.listen(env.APP_PORT, () => {
  logger.info(`Backend running on http://localhost:${env.APP_PORT}`)
})
