import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source = fs.readFileSync('src/page/pre-departure/PreDeparturePage.tsx', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
const tick = () => new Promise(resolve => setImmediate(resolve))
async function setup(initial, recording = true) {
  const state = [], effects = [], calls = []
  let cursor = 0, first = true, result = initial
  const jsx = (type, props) => ({ type, props })
  const react = {
    useState(value) { const i = cursor++; if (first) state[i] = typeof value === 'function' ? value() : value; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }] },
    useRef: () => ({ current: null }), useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn) { if (first) effects.push(fn) },
  }
  const api = new Proxy({}, { get: (_, name) => async (...args) => {
    calls.push([name, ...args])
    if (name === 'getApplication') return { composedText: '录音整理后的问题', consumed: false }
    if (name === 'understandProblem') return result
    if (name === 'startDiagnosis') return { id: 'diagnosis-1' }
  } })
  const exports = {}
  vm.runInNewContext(code, {
    exports, require: name => {
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === '../../api') return { api }
      if (name === '../../i18n') return { useLanguage: () => ({ language: 'zh-CN', text: zh => zh }) }
      return new Proxy({}, { get: (_, key) => key === 'setActiveDiagnosisSessionId' ? () => {} : key })
    },
    URLSearchParams, window: { location: { search: recording ? '?recordingApplicationId=app-1' : '' }, setTimeout: fn => { fn(); return 0 } },
    document: { getElementById: () => null },
  })
  const render = () => { cursor = 0; const tree = exports.PreDeparturePage(); first = false; return tree }
  function find(type, predicate = () => true) {
    function walk(node) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { for (const child of node) { const found = walk(child); if (found) return found } }
      else { if (node.type === type && predicate(node.props)) return node.props; return walk(node.props?.children) }
    }
    return walk(render())
  }
  render(); effects.forEach(fn => fn()); await tick()
  return { calls, find, setResult: value => { result = value }, count: name => calls.filter(call => call[0] === name).length }
}
const complete = { id: 'u1', readyForAnalysis: true, fields: [] }
const missingB = { ...complete, fields: [{ code: 'status', level: 'B', state: 'MISSING', prompt: '设备是否运行？' }] }
const blocked = { ...complete, readyForAnalysis: false, fields: [{ code: 'model', level: 'A', state: 'MISSING' }] }
{
  const h = await setup(complete)
  assert.equal(h.find('textarea').value, '录音整理后的问题')
  assert.equal(h.count('understandProblem'), 1)
  assert.equal(h.count('startDiagnosis'), 1)
  assert.equal(h.calls.find(c => c[0] === 'startDiagnosis')[1].continueWithoutRecommendedFields, false)
  assert.equal(h.count('attachDiagnosis'), 1)
}
{
  const h = await setup(missingB)
  assert.equal(h.count('startDiagnosis'), 0)
  const modal = h.find('RecommendedConfirm')
  assert.equal(modal.fields.length, 1)
  modal.onContinue(); await tick()
  assert.equal(h.count('startDiagnosis'), 1)
  assert.equal(h.calls.find(c => c[0] === 'startDiagnosis')[1].continueWithoutRecommendedFields, true)
  assert.equal(h.count('attachDiagnosis'), 1)
}
for (const initial of [missingB, blocked]) {
  const h = await setup(initial)
  if (initial === missingB) h.find('RecommendedConfirm').onCancel()
  assert.equal(h.find('RecommendedConfirm'), undefined)
  assert.equal(h.count('startDiagnosis'), 0)
  h.find('textarea').onChange({ target: { value: '补全问题' } })
  h.setResult(complete)
  await tick()
  assert.equal(h.count('understandProblem'), 1)
  await h.find('button', p => p.onClick?.name === 'analyze').onClick()
  assert.equal(h.count('startDiagnosis'), 0)
  h.find('UnderstandingPanel').onStart(); await tick()
  assert.equal(h.count('startDiagnosis'), 1)
}
{
  const h = await setup(missingB, false)
  assert.equal(h.count('understandProblem'), 0)
  await h.find('button', p => p.onClick?.name === 'analyze').onClick()
  assert.equal(h.find('RecommendedConfirm'), undefined)
  h.find('UnderstandingPanel').onStart()
  assert.equal(h.find('RecommendedConfirm').fields.length, 1)
  assert.equal(h.count('startDiagnosis'), 0)
}
console.log('PASS: 5 flow scenarios (mock API and hook harness): complete recording, B confirmation, B return/edit, A block/manual retry, manual entry.')
