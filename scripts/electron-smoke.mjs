import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder/package.json'))
const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'))
const { listPackage, extractFile } = appBuilderRequire('@electron/asar')
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const appDirectory = path.resolve(process.argv[2] ?? '')
assert(process.argv[2], 'Pass the unpacked application directory')
const resources = path.join(
  appDirectory,
  appDirectory.endsWith('.app') ? 'Contents/Resources' : 'resources'
)
const archive = path.join(resources, 'app.asar')
const entries = new Set(listPackage(archive).map((file) => file.replaceAll('\\', '/')))

for (const file of [
  'package.json',
  'dist/index.html',
  'dist-electron/main/index.js',
  'dist-electron/preload/index.cjs',
  'node_modules/ws/package.json',
  'node_modules/ws/index.js'
]) {
  assert(entries.has(`/${file}`), `Missing packaged runtime file: ${file}`)
}
const html = extractFile(archive, 'dist/index.html').toString()
const assets = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"?#]+)"/g)].map((match) => match[1])
assert(assets.length > 0, 'No bundled assets referenced by index.html')
for (const asset of assets) assert(entries.has(`/dist/${asset}`), `Missing asset: ${asset}`)
console.log(`Verified packaged runtime and ${assets.length} HTML assets`)

if (!process.argv.includes('--verify-only')) {
  // Run against disposable CI runners only; never open a developer's stored accounts.
  assert.equal(
    process.env.CI,
    'true',
    'Application startup smoke tests require a disposable CI runner'
  )
  const installers = readdirSync(path.dirname(appDirectory))
  const expected = process.platform === 'win32' ? ['.exe'] : ['.AppImage', '.deb']
  for (const extension of expected) {
    assert(
      installers.some((file) => file.endsWith(extension)),
      `Missing installer: ${extension}`
    )
  }
  const executablePath = ['Jumble.exe', 'jumble', 'Jumble']
    .map((name) => path.join(appDirectory, name))
    .find((file) => existsSync(file))
  assert(executablePath, 'Packaged executable not found')
  const output = path.resolve('test-results/electron')
  mkdirSync(output, { recursive: true })
  const failures = []
  const logs = []
  let application
  let page
  try {
    application = await electron.launch({
      executablePath,
      args: process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [],
      timeout: 60_000
    })
    application.process().stderr?.on('data', (data) => logs.push(data.toString()))
    page = await application.firstWindow({ timeout: 60_000 })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('console', (message) => {
      logs.push(`[${message.type()}] ${message.text()}\n`)
      if (/\[main\] failed to bootstrap|ErrorBoundary caught/.test(message.text())) {
        failures.push(message.text())
      }
    })
    await page.waitForFunction(() => !!window.electron?.security, null, { timeout: 60_000 })
    const status = await page.evaluate(() => window.electron.security.getStatus())
    if (status.backend === 'password' && !status.unlocked) {
      assert(status.needsSetup, 'CI unexpectedly contains an existing password-protected store')
      // A fresh Linux runner may have no keychain. Exercise its real password boot path.
      await page.evaluate(
        (password) => window.electron.security.setupPassword(password),
        randomUUID()
      )
      await page.reload()
    }
    await page.waitForFunction(
      () => document.querySelector('#root')?.textContent.trim().length > 0,
      null,
      {
        timeout: 60_000
      }
    )
    assert.equal(new URL(page.url()).protocol, 'app:', 'Expected the packaged app:// protocol')
    assert.equal(await application.evaluate(({ app }) => app.isPackaged), true)
    assert.equal(await application.evaluate(({ app }) => app.getVersion()), version)
    assert.equal(await page.evaluate(() => typeof window.electron.relay.subscribe), 'function')
    await page.getByTitle('Settings', { exact: true }).click()
    await page.getByText('Preferences', { exact: true }).waitFor({ state: 'visible' })
    assert.deepEqual(failures, [], 'Renderer startup errors')
    await page.screenshot({ path: path.join(output, 'settings.png') })
    writeFileSync(
      path.join(output, 'result.json'),
      JSON.stringify(
        { platform: process.platform, arch: process.arch, version, passed: true },
        null,
        2
      )
    )
    console.log('Packaged application startup, IPC, and Settings navigation passed')
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    writeFileSync(path.join(output, 'electron.log'), logs.join(''))
    await application?.close()
  }
}
