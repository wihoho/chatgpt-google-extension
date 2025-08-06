#!/usr/bin/env node

/**
 * Simple CI Tests for ChatGPT Calendar Extension
 * Runs basic validation tests that don't require browser automation
 */

const fs = require('fs')
const path = require('path')

class SimpleCITester {
  constructor() {
    this.startTime = Date.now()
    this.results = {
      tests: [],
      summary: { passed: 0, failed: 0, duration: 0 },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type] || '📋'
    
    console.log(`${prefix} [${timestamp}] ${message}`)
  }

  addTestResult(name, success, details = '') {
    this.results.tests.push({
      name,
      success,
      details,
      timestamp: new Date().toISOString()
    })
    
    if (success) {
      this.results.summary.passed++
      this.log(`${name}: PASS`, 'success')
    } else {
      this.results.summary.failed++
      this.log(`${name}: FAIL - ${details}`, 'error')
    }
  }

  testBuildOutput() {
    this.log('Testing build output...')
    
    const buildPath = path.resolve(__dirname, '../../build/chromium')
    
    // Check if build directory exists
    if (!fs.existsSync(buildPath)) {
      this.addTestResult('Build Directory Exists', false, `Build directory not found at ${buildPath}`)
      return
    }
    
    this.addTestResult('Build Directory Exists', true)
    
    // Check required files
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'content-script.js',
      'options.html',
      'options.js',
      'popup.html',
      'popup.js'
    ]
    
    for (const file of requiredFiles) {
      const filePath = path.join(buildPath, file)
      const exists = fs.existsSync(filePath)
      this.addTestResult(`Required File: ${file}`, exists, exists ? '' : `File not found: ${filePath}`)
    }
    
    // Check manifest.json content
    try {
      const manifestPath = path.join(buildPath, 'manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      
      // Check required manifest fields
      const requiredFields = ['name', 'version', 'manifest_version', 'permissions', 'background', 'content_scripts']
      for (const field of requiredFields) {
        const hasField = manifest.hasOwnProperty(field)
        this.addTestResult(`Manifest Field: ${field}`, hasField, hasField ? '' : `Missing field: ${field}`)
      }
      
      // Check version format
      const versionRegex = /^\d+\.\d+\.\d+$/
      const validVersion = versionRegex.test(manifest.version)
      this.addTestResult('Manifest Version Format', validVersion, validVersion ? manifest.version : `Invalid version: ${manifest.version}`)
      
    } catch (error) {
      this.addTestResult('Manifest JSON Valid', false, error.message)
    }
  }

  testPackageJson() {
    this.log('Testing package.json...')
    
    try {
      const packagePath = path.resolve(__dirname, '../../package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      
      // Check required scripts
      const requiredScripts = ['build', 'test:e2e', 'test:e2e:ci']
      for (const script of requiredScripts) {
        const hasScript = packageJson.scripts && packageJson.scripts.hasOwnProperty(script)
        this.addTestResult(`Package Script: ${script}`, hasScript, hasScript ? '' : `Missing script: ${script}`)
      }
      
      // Check if Puppeteer is installed
      const hasPuppeteer = packageJson.devDependencies && packageJson.devDependencies.hasOwnProperty('puppeteer')
      this.addTestResult('Puppeteer Dependency', hasPuppeteer, hasPuppeteer ? '' : 'Puppeteer not found in devDependencies')
      
    } catch (error) {
      this.addTestResult('Package JSON Valid', false, error.message)
    }
  }

  testSourceFiles() {
    this.log('Testing source files...')
    
    const srcPath = path.resolve(__dirname, '../../src')
    
    // Check if src directory exists
    if (!fs.existsSync(srcPath)) {
      this.addTestResult('Source Directory Exists', false, `Source directory not found at ${srcPath}`)
      return
    }
    
    this.addTestResult('Source Directory Exists', true)
    
    // Check required source files
    const requiredSrcFiles = [
      'manifest.json',
      'background/index.ts',
      'content-script/index.ts',
      'options/index.tsx',
      'popup/index.tsx'
    ]
    
    for (const file of requiredSrcFiles) {
      const filePath = path.join(srcPath, file)
      const exists = fs.existsSync(filePath)
      this.addTestResult(`Source File: ${file}`, exists, exists ? '' : `File not found: ${filePath}`)
    }
  }

  testTestFiles() {
    this.log('Testing test files...')

    const testPath = path.resolve(__dirname, '..')
    const rootPath = path.resolve(__dirname, '../..')

    // Check if test directory exists
    if (!fs.existsSync(testPath)) {
      this.addTestResult('Test Directory Exists', false, `Test directory not found at ${testPath}`)
      return
    }

    this.addTestResult('Test Directory Exists', true)
    
    // Check required test files
    const requiredTestFiles = [
      'e2e/setup-e2e-tests.js',
      'e2e/ci-e2e-tests.js',
      'test-page.html',
      'MANUAL_TESTING_GUIDE.md',
      'extension-debug.js'
    ]

    // Check E2E test pages
    const requiredTestPages = [
      'e2e/test-pages/index.html',
      'e2e/test-pages/simple-meeting.html',
      'e2e/test-pages/doctor-appointment.html',
      'e2e/test-pages/complex-event.html',
      'e2e/test-pages/vague-text.html',
      'e2e/test-pages/timeout-test.html',
      'e2e/test-pages/README.md'
    ]
    
    for (const file of requiredTestFiles) {
      const filePath = path.join(testPath, file)
      const exists = fs.existsSync(filePath)
      this.addTestResult(`Test File: ${file}`, exists, exists ? '' : `File not found: ${filePath}`)
    }

    // Check E2E test pages
    for (const file of requiredTestPages) {
      const filePath = path.join(testPath, file)
      const exists = fs.existsSync(filePath)
      this.addTestResult(`Test Page: ${file}`, exists, exists ? '' : `File not found: ${filePath}`)
    }

    // Check for troubleshooting guide in root
    const troubleshootingPath = path.join(rootPath, 'TROUBLESHOOTING.md')
    const troubleshootingExists = fs.existsSync(troubleshootingPath)
    this.addTestResult('Troubleshooting Guide', troubleshootingExists, troubleshootingExists ? '' : `File not found: ${troubleshootingPath}`)
  }

  generateReport() {
    this.results.summary.duration = Date.now() - this.startTime
    
    const reportPath = path.join(__dirname, 'simple-ci-test-report.json')
    const htmlReportPath = path.join(__dirname, 'simple-ci-test-report.html')
    
    // Generate JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2))
    
    // Generate HTML report
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>Simple CI Test Report - ChatGPT Calendar Extension</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .summary { background: ${this.results.summary.failed === 0 ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .pass { border-left-color: #28a745; background: #d4edda; }
        .fail { border-left-color: #dc3545; background: #f8d7da; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Simple CI Test Report</h1>
        <p><strong>Extension:</strong> ChatGPT for Google Calendar</p>
        <p><strong>Timestamp:</strong> ${this.results.environment.timestamp}</p>
        <p><strong>Duration:</strong> ${(this.results.summary.duration / 1000).toFixed(2)}s</p>
        <p><strong>Platform:</strong> ${this.results.environment.platform}</p>
        <p><strong>Node Version:</strong> ${this.results.environment.nodeVersion}</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> ${this.results.summary.passed + this.results.summary.failed}</p>
        <p><strong>Passed:</strong> ${this.results.summary.passed}</p>
        <p><strong>Failed:</strong> ${this.results.summary.failed}</p>
        <p><strong>Success Rate:</strong> ${((this.results.summary.passed / (this.results.summary.passed + this.results.summary.failed)) * 100).toFixed(1)}%</p>
    </div>
    
    <h2>Test Results</h2>
    ${this.results.tests.map(test => `
        <div class="test-result ${test.success ? 'pass' : 'fail'}">
            <h3>${test.success ? '✅' : '❌'} ${test.name}</h3>
            ${test.details ? `<p>Details: ${test.details}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>
    `
    
    fs.writeFileSync(htmlReportPath, htmlReport)
    
    this.log(`Test report generated: ${reportPath}`)
    this.log(`HTML report generated: ${htmlReportPath}`)
  }

  async runAllTests() {
    this.log('🚀 Starting Simple CI Tests...')
    this.log('=' .repeat(60))

    try {
      this.testBuildOutput()
      this.testPackageJson()
      this.testSourceFiles()
      this.testTestFiles()
      
    } catch (error) {
      this.log(`Unexpected error: ${error.message}`, 'error')
      this.addTestResult('Test Execution', false, error.message)
    }

    this.generateReport()

    this.log('\n📊 Simple CI Test Results:')
    this.log('=' .repeat(60))
    this.log(`Total Tests: ${this.results.summary.passed + this.results.summary.failed}`)
    this.log(`Passed: ${this.results.summary.passed}`)
    this.log(`Failed: ${this.results.summary.failed}`)
    this.log(`Duration: ${(this.results.summary.duration / 1000).toFixed(2)}s`)

    const exitCode = this.results.summary.failed === 0 ? 0 : 1
    
    if (exitCode === 0) {
      this.log('🎉 All simple CI tests passed! Build is valid.', 'success')
    } else {
      this.log('⚠️ Some simple CI tests failed. Please review.', 'warning')
    }

    return this.results
  }
}

// Main test runner
async function runSimpleCITests() {
  const tester = new SimpleCITester()
  const results = await tester.runAllTests()
  
  // Exit with appropriate code for CI
  const exitCode = results.summary.failed === 0 ? 0 : 1
  process.exit(exitCode)
}

// Export for use in other scripts
module.exports = {
  SimpleCITester,
  runSimpleCITests
}

// Run tests if called directly
if (require.main === module) {
  runSimpleCITests().catch(error => {
    console.error('❌ Simple CI tests failed:', error.message)
    process.exit(1)
  })
}
