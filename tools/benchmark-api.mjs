#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { privateKeyToAccount } from '../carbon-dapp/node_modules/viem/_esm/accounts/index.js'
import { buildWalletAuthMessage } from '../carbon-dapp/src/lib/walletAuth.js'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i]
    if (!part.startsWith('--')) continue
    const key = part.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      if (Object.hasOwn(args, key)) {
        args[key] = Array.isArray(args[key]) ? [...args[key], true] : [args[key], true]
      } else {
        args[key] = true
      }
      continue
    }
    if (Object.hasOwn(args, key)) {
      args[key] = Array.isArray(args[key]) ? [...args[key], next] : [args[key], next]
    } else {
      args[key] = next
    }
    i += 1
  }
  return args
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9.-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

async function runOne({ url, method = 'GET', body, headers = {} }) {
  const started = performance.now()
  const response = await fetch(url, {
    method,
    headers,
    body,
  })
  const text = await response.text()
  const duration = performance.now() - started
  return {
    ok: response.ok,
    status: response.status,
    duration,
    bytes: Buffer.byteLength(text, 'utf8'),
    bodyPreview: text.slice(0, 180),
  }
}

async function maybeBuildWalletAuthHeaders(args) {
  if (!args['auth-purpose'] || !args['private-key']) {
    return {}
  }

  const purpose = String(args['auth-purpose'])
  const account = privateKeyToAccount(String(args['private-key']))
  const timestamp = Date.now().toString()
  const message = buildWalletAuthMessage({
    address: account.address,
    purpose,
    timestamp,
  })
  const signature = await account.signMessage({ message })

  return {
    'x-wallet-address': account.address,
    'x-wallet-purpose': purpose,
    'x-wallet-timestamp': timestamp,
    'x-wallet-signature': signature,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = args.url
  if (!url) {
    console.error('Usage: node tools/benchmark-api.mjs --url <url> [--runs 5] [--method GET] [--body \'{"x":1}\'] [--header "Key: Value"] [--save docs/measurements]')
    process.exit(1)
  }

  const runs = Number(args.runs || 5)
  const method = String(args.method || 'GET').toUpperCase()
  const body = args.body ? String(args.body) : undefined

  const headers = {}
  const headerArg = args.header
  if (headerArg) {
    const headerList = Array.isArray(headerArg) ? headerArg : [headerArg]
    for (const item of headerList) {
      const idx = String(item).indexOf(':')
      if (idx > 0) {
        const key = item.slice(0, idx).trim()
        const value = item.slice(idx + 1).trim()
        headers[key] = value
      }
    }
  }
  if (body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  Object.assign(headers, await maybeBuildWalletAuthHeaders(args))

  const results = []
  for (let i = 0; i < runs; i += 1) {
    const result = await runOne({ url, method, body, headers })
    results.push(result)
    console.log(
      `Run ${i + 1}: status=${result.status} ok=${result.ok} duration=${result.duration.toFixed(2)}ms bytes=${result.bytes}`
    )
  }

  const durations = results.map((r) => r.duration)
  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length
  const min = Math.min(...durations)
  const max = Math.max(...durations)
  const p95 = percentile(durations, 95)
  const errors = results.filter((r) => !r.ok).length

  console.log('\nSummary')
  console.log(`URL: ${url}`)
  console.log(`Method: ${method}`)
  console.log(`Runs: ${runs}`)
  console.log(`Average: ${avg.toFixed(2)} ms`)
  console.log(`Min: ${min.toFixed(2)} ms`)
  console.log(`Max: ${max.toFixed(2)} ms`)
  console.log(`P95: ${p95?.toFixed(2)} ms`)
  console.log(`Error rate: ${((errors / runs) * 100).toFixed(2)} %`)

  if (args.save) {
    const outputDir = path.resolve(process.cwd(), String(args.save))
    const targetUrl = new URL(String(url))
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const targetName = sanitizeFileName(`${method}-${targetUrl.hostname}${targetUrl.pathname || ''}-${timestamp}.json`)
    const targetPath = path.join(outputDir, targetName)
    await mkdir(outputDir, { recursive: true })
    await writeFile(
      targetPath,
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        url,
        method,
        usedWalletAuth: Boolean(args['auth-purpose'] && args['private-key']),
        runs,
        summary: {
          averageMs: Number(avg.toFixed(2)),
          minMs: Number(min.toFixed(2)),
          maxMs: Number(max.toFixed(2)),
          p95Ms: Number((p95 ?? 0).toFixed(2)),
          errorRatePercent: Number((((errors / runs) * 100)).toFixed(2)),
        },
        results,
      }, null, 2)}\n`,
      'utf8'
    )
    console.log(`Saved benchmark JSON: ${targetPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
