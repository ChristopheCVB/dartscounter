// vue-tsc patches fs.readFileSync while loading TypeScript; Bun's loader bypasses it.
// Load TypeScript through fs so typecheck includes Vue files under Bun.
const fs = require('node:fs')
const Module = /** @type {typeof import('node:module') & {
  _extensions: { '.js': (module: { _compile(source: string, filename: string): void }, filename: string) => void }
}} */ (require('node:module'))

const loadJs = Module._extensions['.js']
Module._extensions['.js'] = /** @type {typeof loadJs} */ ((module, filename) =>
  /[\\/]typescript[\\/]lib[\\/]/.test(filename)
    ? module._compile(fs.readFileSync(filename, 'utf8'), filename)
    : loadJs(module, filename))
