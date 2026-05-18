#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const steps = [
  { name: 'carbon-allowance tests', cwd: 'carbon-allowance', command: 'npm.cmd', args: ['test'] },
  { name: 'carbon-dapp lint', cwd: 'carbon-dapp', command: 'npm.cmd', args: ['run', 'lint'] },
  { name: 'carbon-dapp build', cwd: 'carbon-dapp', command: 'npm.cmd', args: ['run', 'build'] },
  { name: 'quota-calculator build', cwd: 'quota-calculator', command: 'npm.cmd', args: ['run', 'build'] },
]

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(rootDir, 'docs', 'measurements')

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${step.name} ===`)
    const started = Date.now()
    const child = spawn(step.command, step.args, {
      cwd: path.join(rootDir, step.cwd),
      stdio: 'inherit',
      shell: true,
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('exit', (code) => {
      const durationMs = Date.now() - started
      if (code === 0) {
        resolve({
          name: step.name,
          cwd: step.cwd,
          command: `${step.command} ${step.args.join(' ')}`,
          durationMs,
          status: 'passed',
        })
        return
      }
      reject(new Error(`${step.name} failed with exit code ${code}`))
    })
  })
}

async function writeSummary(results) {
  await mkdir(outputDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(outputDir, `validation-${timestamp}.json`)
  const mdPath = path.join(outputDir, `validation-${timestamp}.md`)
  const payload = {
    generatedAt: new Date().toISOString(),
    results,
  }
  const markdown = [
    '# Automated Validation Summary',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    '| Step | Command | Status | Duration (ms) |',
    '|---|---|---|---:|',
    ...results.map((result) => `| ${result.name} | \`${result.command}\` | ${result.status} | ${result.durationMs} |`),
    '',
  ].join('\n')

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, `${markdown}\n`, 'utf8')

  console.log(`\nJSON summary: ${jsonPath}`)
  console.log(`Markdown summary: ${mdPath}`)
}

async function main() {
  const results = []
  for (const step of steps) {
    try {
      results.push(await runStep(step))
    } catch (error) {
      results.push({
        name: step.name,
        cwd: step.cwd,
        command: `${step.command} ${step.args.join(' ')}`,
        durationMs: 0,
        status: 'failed',
        error: error.message,
      })
      await writeSummary(results)
      throw error
    }
  }
  await writeSummary(results)
  console.log('\nValidation pipeline completed successfully.')
}

main().catch((error) => {
  console.error(`\nValidation pipeline failed: ${error.message}`)
  process.exit(1)
})
