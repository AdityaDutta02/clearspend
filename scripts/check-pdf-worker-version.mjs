// Fails if the vendored worker is missing or its embedded version
// does not match the installed pdfjs-dist. Run in CI / pre-deploy.
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const installed = require('pdfjs-dist/package.json').version
const workerPath = new URL('../public/pdf.worker.min.mjs', import.meta.url)

if (!existsSync(workerPath)) {
  console.error(`[pdf-worker] MISSING public/pdf.worker.min.mjs — run: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs`)
  process.exit(1)
}

const contents = readFileSync(workerPath, 'utf8')
if (!contents.includes(installed)) {
  console.error(`[pdf-worker] VERSION DRIFT — installed pdfjs-dist=${installed} not found in vendored worker. Re-copy the worker.`)
  process.exit(1)
}
console.log(`[pdf-worker] OK — vendored worker matches pdfjs-dist@${installed}`)
