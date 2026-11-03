import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
function fixture(base) {
  const listeners = new Map(), effects = [], entries = [], states = []
  let index = -1, rendered
  const window = {
    location: { pathname: base + 'pre-departure', search: '?draft=1', hash: '#evidence' },
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (event) => listeners.get(event.type)?.(),
  }
  const setUrl = (url) => { const parsed = new URL(url, 'https://example.test'); Object.assign(window.location, { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash }) }
  window.history = {
    state: null,
    pushState(state, _, url) { entries.splice(++index); states.splice(index); entries.push(url); states.push(state); this.state = state; setUrl(url) },
    replaceState(state, _, url) { entries[index] = url; states[index] = state; this.state = state; setUrl(url) },
    go(delta) { index += delta; this.state = states[index]; setUrl(entries[index]); window.dispatchEvent({ type: 'popstate' }) },
  }
  window.history.pushState({}, '', window.location.pathname + window.location.search + window.location.hash)
  const source = [read('../src/common/urls.ts'), read('../src/common/constant/route.ts'), read('../src/common/hook/useAppRoute.ts')].join('\n')
    .replace(/^import .*$/gm, '').replaceAll('import.meta.env.BASE_URL', JSON.stringify(base)).replaceAll('import.meta.env.VITE_API_BASE_URL', "''").replaceAll('export ', '')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const context = vm.createContext({ window, PopStateEvent: class { constructor(type) { this.type = type } }, useEffect: (effect) => effects.push(effect), useState: (init) => [rendered = init(), (value) => { rendered = value }] })
  vm.runInContext(js + '\nglobalThis.api = {appUrl, routePath, resolveApiUrl, navigate, useAppRoute};', context)
  context.api.useAppRoute(); effects.forEach((effect) => effect())
  return { ...context.api, window, path: () => rendered }
}
for (const base of ['/', '/ai-repair/']) {
  test(`direct access, refresh, links, history and state under ${base}`, () => {
    const app = fixture(base)
    assert.equal(app.path(), '/pre-departure')
    assert.equal(app.appUrl('/reports'), base + 'reports')
    app.navigate('/recordings')
    app.navigate('/pre-departure', { recordingBatchId: 'batch' })
    assert.equal(app.window.location.pathname, base + 'pre-departure')
    assert.equal(app.window.history.state.recordingBatchId, 'batch')
    app.window.history.go(-1); assert.equal(app.path(), '/recordings')
    app.window.history.go(1); assert.equal(app.path(), '/pre-departure')
    app.useAppRoute(); assert.equal(app.path(), '/pre-departure')
    app.window.history.pushState({}, '', base + 'unknown?keep=1#keep')
    app.window.dispatchEvent({ type: 'popstate' })
    assert.equal(app.window.location.pathname, base + 'recordings')
    assert.equal(app.window.location.search, '?keep=1')
    assert.equal(app.window.location.hash, '#keep')
  })
  test(`API, media and already prefixed URLs under ${base}`, () => {
    const app = fixture(base)
    for (const path of ['/api/v1/system/status', '/api/v1/knowledge/manuals/1/document', '/api/v1/recording-files/1/content', '/api/v1/recording-batches/1/transcription-stream']) {
      assert.equal(app.resolveApiUrl(path), base + path.slice(1))
      assert.equal(app.resolveApiUrl(base + path.slice(1)), base + path.slice(1))
    }
    assert.equal(app.resolveApiUrl('/api/v1/reports', 'https://api.test/'), 'https://api.test/api/v1/reports')
    assert.equal(app.resolveApiUrl('https://files.test/a.pdf'), 'https://files.test/a.pdf')
    assert.equal(app.routePath('/ai-repair-other/reports'), '/ai-repair-other/reports')
  })
}
