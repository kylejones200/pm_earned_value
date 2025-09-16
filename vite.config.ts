import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const mockApiPlugin: Plugin = {
    name: 'mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/sendTranscript', async (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req as any) chunks.push(chunk as Buffer)
          const bodyStr = Buffer.concat(chunks).toString('utf8')
          const body = bodyStr ? JSON.parse(bodyStr) : {}
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(
            JSON.stringify({ ok: true, received: { subject: body?.subject, length: (body?.transcript?.length ?? 0) } })
          )
        } catch (e) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Bad Request' }))
        }
      })
    }
  }

  return {
    plugins: [react(), mockApiPlugin],
  }
})
