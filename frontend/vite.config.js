import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, 'data')

// Only runs during `npm run dev`. Frontend POSTs here so /data/*.json stays updated on disk. Won't run in production build.
function talentmatchDataMirrorPlugin() {
  const allowed = new Set([
    'candidate-profile-draft.json',
    'candidate-profile.json',
    'employer-profile-draft.json',
    'employer-profile.json',
    'job-applications.json',
    'employer-posted-jobs.json',
    'employer-create-job-draft.json',
  ])

  return {
    name: 'talentmatch-data-mirror',
    configureServer(server) {
      server.middlewares.use('/__talentmatch/write-json', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}')
            const { file, data } = parsed
            if (!file || !allowed.has(file)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, message: 'Invalid file name' }))
              return
            }
            fs.mkdirSync(dataDir, { recursive: true })
            const target = path.join(dataDir, file)
            fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, message: String(err) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), talentmatchDataMirrorPlugin()],
})
