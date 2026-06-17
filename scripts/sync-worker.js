#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const root = path.resolve(__dirname, '..')
const config = readJSON(path.join(root, 'worker-sync.config.json'))
const managedDeps = readJSON(path.join(root, 'worker-managed-deps.json')).dependencies
const workerRelPath = config.workerPath
const workerSource = fs.readFileSync(path.join(root, workerRelPath), 'utf8')

const command = process.argv[2]
const repoArgs = process.argv.slice(3)

if (command !== 'sync' && command !== 'check') {
  usage(1)
}

if (repoArgs.length === 0) {
  console.error('No repo paths provided.')
  usage(1)
}

let hasDiff = false

for (const repoArg of repoArgs) {
  const repoRoot = path.resolve(process.cwd(), repoArg)
  const changed = syncRepo(repoRoot, command === 'check')
  if (changed) hasDiff = true
}

process.exit(command === 'check' && hasDiff ? 1 : 0)

function usage(code) {
  console.error('Usage: node scripts/sync-worker.js <sync|check> <repo-path> [repo-path...]')
  process.exit(code)
}

function syncRepo(repoRoot, checkOnly) {
  const workerTarget = path.join(repoRoot, workerRelPath)
  const packagePath = path.join(repoRoot, 'package.json')

  assertExists(repoRoot)
  assertExists(packagePath)

  const pkg = readJSON(packagePath)
  const nextPkg = updatePackageJSON(pkg)
  const nextPkgRaw = stringifyJSON(nextPkg)
  const currentPkgRaw = fs.readFileSync(packagePath, 'utf8')
  const currentWorker = fs.existsSync(workerTarget) ? fs.readFileSync(workerTarget, 'utf8') : ''

  const workerChanged = currentWorker !== workerSource
  const packageChanged = currentPkgRaw !== nextPkgRaw
  const changed = workerChanged || packageChanged

  if (!changed) {
    console.log(`${repoRoot}: up to date`)
    return false
  }

  if (checkOnly) {
    console.log(`${repoRoot}: drift detected`)
    return true
  }

  fs.mkdirSync(path.dirname(workerTarget), { recursive: true })
  fs.writeFileSync(workerTarget, workerSource)
  fs.writeFileSync(packagePath, nextPkgRaw)
  run('npm', ['install'], repoRoot)
  console.log(`${repoRoot}: synced`)
  return true
}

function updatePackageJSON(pkg) {
  const next = { ...pkg }
  const currentDeps = { ...(pkg.dependencies || {}) }

  for (const name of Object.keys(currentDeps)) {
    if (!(name in managedDeps)) continue
    delete currentDeps[name]
  }

  for (const [name, version] of Object.entries(managedDeps)) {
    currentDeps[name] = version
  }

  next.dependencies = sortObject(currentDeps)
  return next
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}

function stringifyJSON(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function assertExists(file) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required path: ${file}`)
    process.exit(1)
  }
}

function run(cmd, args, cwd) {
  const isWindows = process.platform === 'win32'
  const result = isWindows
    ? cp.spawnSync(`${cmd}.cmd`, args, { cwd, stdio: 'inherit', shell: true })
    : cp.spawnSync(cmd, args, { cwd, stdio: 'inherit' })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}
