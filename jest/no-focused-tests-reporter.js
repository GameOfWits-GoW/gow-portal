const fs = require('fs')
const path = require('path')

const focusedTestPattern = /\b(?:describe|it|test)\s*\.\s*only\s*\(/

class NoFocusedTestsReporter {
  constructor(globalConfig) {
    this.isCi = globalConfig.ci
  }

  onRunStart() {
    if (!this.isCi) return

    const focusedTests = this.findFocusedTests(path.join(process.cwd(), 'src'))
    if (focusedTests.length > 0)
      throw new Error(`Focused Jest tests are not allowed in CI: ${focusedTests.join(', ')}`)
  }

  findFocusedTests(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return this.findFocusedTests(entryPath)
      if (!entry.name.endsWith('.spec.ts')) return []
      return focusedTestPattern.test(fs.readFileSync(entryPath, 'utf8'))
        ? [path.relative(process.cwd(), entryPath)]
        : []
    })
  }
}

module.exports = NoFocusedTestsReporter
