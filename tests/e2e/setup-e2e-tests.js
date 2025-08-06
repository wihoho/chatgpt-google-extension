/**
 * End-to-End Test Setup for ChatGPT Calendar Extension
 * Uses Puppeteer to automate Chrome browser with extension loaded
 */

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

// Test configuration
const E2E_CONFIG = {
  extensionPath: path.resolve(__dirname, '../../build/chromium'),
  testTimeout: 30000,
  chromeArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
}

// Test data for event extraction
const TEST_SCENARIOS = [
  {
    name: 'Simple meeting with date and time',
    text: 'Team meeting tomorrow at 2:00 PM in Conference Room A',
    expectedFields: ['title', 'startDate'],
    shouldSucceed: true
  },
  {
    name: 'Doctor appointment with specific date',
    text: 'Doctor appointment on March 15th at 10:30 AM at Medical Center',
    expectedFields: ['title', 'startDate', 'location'],
    shouldSucceed: true
  },
  {
    name: 'Complex event with all details',
    text: 'Annual company retreat from March 20-22, 2024 at Mountain Resort Lodge. All employees invited for team building activities.',
    expectedFields: ['title', 'startDate', 'endDate', 'location', 'description'],
    shouldSucceed: true
  },
  {
    name: 'Vague text without clear event info',
    text: 'This is just some random text without any event information or dates.',
    expectedFields: [],
    shouldSucceed: false
  },
  {
    name: 'Long complex text (timeout test)',
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100) + 'Meeting at 3 PM',
    expectedFields: ['title', 'startDate'],
    shouldSucceed: true,
    expectTimeout: true
  }
]

class ExtensionE2ETester {
  constructor() {
    this.browser = null
    this.page = null
    this.extensionId = null
  }

  async setup() {
    console.log('🚀 Setting up E2E test environment...')
    
    // Verify extension build exists
    if (!fs.existsSync(E2E_CONFIG.extensionPath)) {
      throw new Error(`Extension build not found at ${E2E_CONFIG.extensionPath}. Run 'npm run build' first.`)
    }

    // Launch Chrome with extension
    this.browser = await puppeteer.launch({
      headless: false, // Show browser for visual verification
      args: [
        `--load-extension=${E2E_CONFIG.extensionPath}`,
        `--disable-extensions-except=${E2E_CONFIG.extensionPath}`,
        ...E2E_CONFIG.chromeArgs
      ],
      defaultViewport: null
    })

    // Wait for extension to load and get extension ID
    console.log('⏳ Waiting for extension to load...')
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

    const targets = this.browser.targets()
    const extensionTarget = targets.find(target =>
      target.type() === 'background_page' && target.url().includes('chrome-extension://')
    )

    if (extensionTarget) {
      this.extensionId = extensionTarget.url().split('/')[2]
      console.log(`✅ Extension loaded with ID: ${this.extensionId}`)
    } else {
      // Try alternative detection method
      const allTargets = targets
      console.log('🔍 Available targets:', allTargets.map(t => ({ type: t.type(), url: t.url() })))

      // Look for any chrome-extension URL
      const anyExtensionTarget = allTargets.find(target => target.url().includes('chrome-extension://'))
      if (anyExtensionTarget) {
        this.extensionId = anyExtensionTarget.url().split('/')[2]
        console.log(`✅ Extension found via alternative method with ID: ${this.extensionId}`)
      } else {
        throw new Error('Extension not loaded properly')
      }
    }

    // Create new page for testing
    this.page = await this.browser.newPage()
    
    // Enable console logging
    this.page.on('console', msg => {
      if (msg.text().includes('[Content Script]') || msg.text().includes('[Background]')) {
        console.log(`🔍 Browser Console: ${msg.text()}`)
      }
    })

    console.log('✅ E2E test environment ready')
  }

  async testEventExtraction(scenario) {
    console.log(`\n🧪 Testing: ${scenario.name}`)
    console.log(`📝 Text: "${scenario.text.substring(0, 100)}${scenario.text.length > 100 ? '...' : ''}"`)

    try {
      // Navigate to a simple test page
      await this.page.goto('data:text/html,<html><body><h1>Test Page</h1><p>Select text below:</p><div id="test-text">' + scenario.text + '</div></body></html>')
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Select the test text
      await this.page.evaluate(() => {
        const textElement = document.getElementById('test-text')
        if (textElement) {
          const range = document.createRange()
          range.selectNodeContents(textElement)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
          return true
        }
        return false
      })

      console.log('✅ Text selected')

      // Right-click to open context menu
      const textElement = await this.page.$('#test-text')
      await textElement.click({ button: 'right' })
      
      console.log('✅ Context menu opened')

      // Wait for context menu and click "Add to calendar"
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Try to click the extension context menu item
      // Note: This might need adjustment based on how context menus are handled
      await this.page.keyboard.press('Escape') // Close context menu for now
      
      // Alternative: Simulate the extension trigger directly
      await this.page.evaluate(() => {
        // Simulate the extension being triggered
        const selectedText = window.getSelection().toString()
        if (selectedText && window.chrome && window.chrome.runtime) {
          window.chrome.runtime.sendMessage({
            action: 'extractEvent',
            text: selectedText
          })
        }
      })

      console.log('✅ Extension triggered')

      // Wait for modal to appear (either confirmation or error)
      const modalAppeared = await this.page.waitForFunction(
        () => document.getElementById('extension-modal-overlay'),
        { timeout: 10000 }
      ).catch(() => false)

      if (!modalAppeared) {
        throw new Error('No modal appeared within timeout')
      }

      console.log('✅ Modal appeared')

      // Check which type of modal appeared
      const modalInfo = await this.page.evaluate(() => {
        const overlay = document.getElementById('extension-modal-overlay')
        const confirmationModal = document.getElementById('extension-confirmation-modal')
        const errorModal = document.getElementById('extension-error-modal')
        
        return {
          overlayExists: !!overlay,
          confirmationModalExists: !!confirmationModal,
          errorModalExists: !!errorModal,
          modalContent: overlay ? overlay.textContent.substring(0, 200) : ''
        }
      })

      console.log('📊 Modal Info:', modalInfo)

      // Verify expected behavior
      if (scenario.shouldSucceed) {
        if (!modalInfo.confirmationModalExists) {
          throw new Error('Expected confirmation modal for successful extraction')
        }
        console.log('✅ Confirmation modal appeared as expected')
      } else {
        if (!modalInfo.errorModalExists) {
          throw new Error('Expected error modal for failed extraction')
        }
        console.log('✅ Error modal appeared as expected')
      }

      // Take screenshot for visual verification
      await this.page.screenshot({
        path: `tests/e2e/screenshots/${scenario.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        fullPage: true
      })

      console.log('📸 Screenshot saved')

      // Close modal
      await this.page.evaluate(() => {
        const overlay = document.getElementById('extension-modal-overlay')
        if (overlay) {
          overlay.remove()
        }
      })

      return {
        success: true,
        modalType: modalInfo.confirmationModalExists ? 'confirmation' : 'error',
        screenshot: `${scenario.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`)
      
      // Take screenshot of failure
      try {
        await this.page.screenshot({
          path: `tests/e2e/screenshots/FAILED_${scenario.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
          fullPage: true
        })
      } catch (screenshotError) {
        console.log('Failed to take failure screenshot:', screenshotError.message)
      }

      return {
        success: false,
        error: error.message,
        screenshot: `FAILED_${scenario.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`
      }
    }
  }

  async testReviewPrompt() {
    console.log('\n🧪 Testing Review Prompt Feature...')

    try {
      // Navigate to extension options page
      await this.page.goto(`chrome-extension://${this.extensionId}/options.html`)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if we can access extension storage
      const storageInfo = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          if (chrome && chrome.storage) {
            chrome.storage.local.get(['successfulEvents', 'reviewPromptDismissed'], (result) => {
              resolve(result)
            })
          } else {
            resolve({ error: 'Chrome storage not available' })
          }
        })
      })

      console.log('📊 Current storage state:', storageInfo)

      // Set successful events to 4 (one before review prompt)
      await this.page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.set({ successfulEvents: 4 }, () => {
            resolve(true)
          })
        })
      })

      console.log('✅ Set successful events to 4')

      // Now test one more successful extraction (should trigger review prompt)
      const reviewPromptScenario = {
        name: 'Review prompt trigger test',
        text: 'Team meeting tomorrow at 3 PM',
        shouldSucceed: true
      }

      const result = await this.testEventExtraction(reviewPromptScenario)
      
      if (result.success && result.modalType === 'confirmation') {
        // Check if review prompt appeared in the modal
        const hasReviewPrompt = await this.page.evaluate(() => {
          const modal = document.getElementById('extension-modal-overlay')
          return modal ? modal.textContent.includes('Enjoying the extension') : false
        })

        if (hasReviewPrompt) {
          console.log('✅ Review prompt appeared as expected')
          return { success: true, reviewPromptShown: true }
        } else {
          console.log('❌ Review prompt did not appear')
          return { success: false, error: 'Review prompt not shown at 5th event' }
        }
      } else {
        return { success: false, error: 'Failed to trigger successful extraction for review prompt test' }
      }

    } catch (error) {
      console.log(`❌ Review prompt test failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...')
    
    if (this.page) {
      await this.page.close()
    }
    
    if (this.browser) {
      await this.browser.close()
    }
    
    console.log('✅ Cleanup complete')
  }

  async runAllTests() {
    const results = {
      scenarios: [],
      reviewPrompt: null,
      summary: { passed: 0, failed: 0 }
    }

    try {
      await this.setup()

      // Create screenshots directory
      const screenshotDir = path.join(__dirname, 'screenshots')
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true })
      }

      // Run event extraction tests
      for (const scenario of TEST_SCENARIOS) {
        const result = await this.testEventExtraction(scenario)
        results.scenarios.push({ scenario: scenario.name, ...result })
        
        if (result.success) {
          results.summary.passed++
        } else {
          results.summary.failed++
        }

        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Test review prompt
      results.reviewPrompt = await this.testReviewPrompt()
      if (results.reviewPrompt.success) {
        results.summary.passed++
      } else {
        results.summary.failed++
      }

    } catch (error) {
      console.log(`❌ E2E test setup failed: ${error.message}`)
      results.summary.failed++
    } finally {
      await this.cleanup()
    }

    return results
  }
}

// Main test runner
async function runE2ETests() {
  console.log('🧪 Starting End-to-End Integration Tests...')
  console.log('=' .repeat(60))

  const tester = new ExtensionE2ETester()
  const results = await tester.runAllTests()

  console.log('\n📊 E2E Test Results:')
  console.log('=' .repeat(60))
  console.log(`Total Tests: ${results.summary.passed + results.summary.failed}`)
  console.log(`Passed: ${results.summary.passed}`)
  console.log(`Failed: ${results.summary.failed}`)

  console.log('\n📋 Detailed Results:')
  results.scenarios.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.scenario}: ${result.success ? 'PASS' : result.error}`)
  })

  if (results.reviewPrompt) {
    const status = results.reviewPrompt.success ? '✅' : '❌'
    console.log(`${status} Review Prompt Test: ${results.reviewPrompt.success ? 'PASS' : results.reviewPrompt.error}`)
  }

  if (results.summary.failed === 0) {
    console.log('\n🎉 All E2E tests passed! Extension is ready for release.')
  } else {
    console.log('\n⚠️  Some E2E tests failed. Please review before release.')
  }

  return results
}

// Export for use in CI/CD
module.exports = {
  ExtensionE2ETester,
  runE2ETests,
  TEST_SCENARIOS,
  E2E_CONFIG
}

// Run tests if called directly
if (require.main === module) {
  runE2ETests().catch(console.error)
}
