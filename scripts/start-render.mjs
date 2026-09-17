import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = process.env.PORT || '10000'
const children = []
let stopping = false

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal)
  }
}

function start(name, executable, args) {
  const child = spawn(process.execPath, [resolve(root, executable), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  children.push(child)
  child.on('error', error => {
    console.error(`${name} failed:`, error)
    process.exitCode = 1
    stop()
  })
  child.on('exit', (code, signal) => {
    if (stopping) return
    console.error(`${name} exited (${signal || code}).`)
    process.exitCode = code || 1
    stop()
  })
  return child
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

start('JSON Server', 'node_modules/json-server/lib/bin.js', [
  'db.json', '--port', '3101', '--host', '127.0.0.1',
])

let ready = false
for (let attempt = 0; attempt < 60 && !stopping; attempt += 1) {
  try {
    const response = await fetch('http://127.0.0.1:3101/pharmacies', {
      signal: AbortSignal.timeout(1000),
    })
    if (response.ok) {
      ready = true
      break
    }
  } catch {
    // JSON Server is still starting.
  }
  await new Promise(resolve => setTimeout(resolve, 500))
}

if (!ready) {
  console.error('JSON Server did not become ready.')
  process.exitCode = 1
  stop()
} else if (!stopping) {
  start('Next.js', 'node_modules/next/dist/bin/next', [
    'start', '-p', port, '-H', '0.0.0.0',
  ])
}
