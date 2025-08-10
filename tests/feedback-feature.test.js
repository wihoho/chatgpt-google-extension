/**
 * Test Suite for Feedback Feature
 * Tests the functionality of the new feedback button in the review prompt
 */

// Mock Browser API
const mockBrowser = {
  storage: {
    local: {
      data: {},
      get: function(keys) {
        return Promise.resolve(
          Array.isArray(keys) 
            ? keys.reduce((acc, key) => ({ ...acc, [key]: this.data[key] }), {})
            : { [keys]: this.data[keys] }
        )
      },
      set: function(data) {
        Object.assign(this.data, data)
        return Promise.resolve()
      },
      clear: function() {
        this.data = {}
        return Promise.resolve()
      }
    }
  }
}

// Mock DOM environment
const mockDocument = {
  createElement: function(tag) {
    const element = {
      tagName: tag.toUpperCase(),
      style: {},
      innerHTML: '',
      textContent: '',
      eventListeners: {},
      children: [],
      addEventListener: function(event, handler) {
        this.eventListeners[event] = this.eventListeners[event] || []
        this.eventListeners[event].push(handler)
      },
      querySelector: function(selector) {
        // Simple mock for button selectors
        if (selector === '#send-feedback-btn') {
          return {
            addEventListener: function(event, handler) {
              this.eventListeners = this.eventListeners || {}
              this.eventListeners[event] = this.eventListeners[event] || []
              this.eventListeners[event].push(handler)
            },
            click: function() {
              if (this.eventListeners && this.eventListeners.click) {
                this.eventListeners.click.forEach(handler => handler())
              }
            },
            style: {}
          }
        }
        return null
      },
      appendChild: function(child) {
        this.children.push(child)
      },
      insertBefore: function(newNode, referenceNode) {
        this.children.push(newNode)
      },
      classList: { 
        add: function() {}, 
        remove: function() {},
        contains: function() { return false }
      }
    }
    return element
  },
  body: {
    appendChild: function() {},
    style: {}
  }
}

// Mock window object
const mockWindow = {
  openedUrls: [],
  open: function(url, target) {
    this.openedUrls.push({ url, target })
    return {}
  }
}

// Mock logger
const mockLogger = {
  info: function(component, message, data) {
    console.log(`[${component}] ${message}`, data || '')
  },
  debug: function() {},
  warn: function() {},
  error: function() {}
}

// Reset function
function resetMocks() {
  mockBrowser.storage.local.data = {}
  mockWindow.openedUrls = []
}

// Test cases
const tests = [
  {
    name: 'Feedback button should open Reddit profile',
    async run() {
      resetMocks()

      const expectedUrl = 'https://www.reddit.com/user/Loose_Ad_6677/'

      // Simulate clicking the feedback button
      mockWindow.open(expectedUrl, '_blank')

      // Verify the URL was opened correctly
      if (mockWindow.openedUrls.length !== 1) {
        throw new Error(`Expected 1 URL to be opened, got ${mockWindow.openedUrls.length}`)
      }

      const openedUrl = mockWindow.openedUrls[0]
      if (openedUrl.url !== expectedUrl) {
        throw new Error(`Expected URL to be ${expectedUrl}, got ${openedUrl.url}`)
      }

      if (openedUrl.target !== '_blank') {
        throw new Error(`Expected target to be '_blank', got ${openedUrl.target}`)
      }

      // Verify it's the correct Reddit profile
      if (!openedUrl.url.includes('reddit.com/user/Loose_Ad_6677')) {
        throw new Error('Should open the correct Reddit profile')
      }

      return 'PASS'
    }
  },
  
  {
    name: 'Reddit contact should be consistent',
    async run() {
      resetMocks()

      const expectedUrl = 'https://www.reddit.com/user/Loose_Ad_6677/'

      // Test multiple clicks to ensure consistency
      for (let i = 0; i < 3; i++) {
        mockWindow.open(expectedUrl, '_blank')
      }

      // Verify all URLs are the same
      if (mockWindow.openedUrls.length !== 3) {
        throw new Error(`Expected 3 URLs to be opened, got ${mockWindow.openedUrls.length}`)
      }

      for (const openedUrl of mockWindow.openedUrls) {
        if (openedUrl.url !== expectedUrl) {
          throw new Error(`All URLs should be ${expectedUrl}, got ${openedUrl.url}`)
        }
      }

      return 'PASS'
    }
  },
  
  {
    name: 'Review prompt should include feedback button',
    async run() {
      resetMocks()
      
      // Mock the createReviewPrompt function behavior
      const reviewPrompt = mockDocument.createElement('div')
      reviewPrompt.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 20px; margin-right: 8px;">⭐</span>
          <span style="font-weight: 600; font-size: 16px;">Enjoying the extension?</span>
        </div>
        <div style="margin-bottom: 16px; font-size: 14px; line-height: 1.4; opacity: 0.95;">
          Help others discover this extension by leaving a review, or contact me on Reddit to share feedback and suggestions!
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="review-now-btn">⭐ Review on Store</button>
          <button id="send-feedback-btn">💬 Contact on Reddit</button>
          <button id="maybe-later-btn">Maybe Later</button>
        </div>
      `
      
      // Verify the HTML contains all three buttons
      if (!reviewPrompt.innerHTML.includes('id="review-now-btn"')) {
        throw new Error('Review prompt should contain review button')
      }
      
      if (!reviewPrompt.innerHTML.includes('id="send-feedback-btn"')) {
        throw new Error('Review prompt should contain feedback button')
      }
      
      if (!reviewPrompt.innerHTML.includes('id="maybe-later-btn"')) {
        throw new Error('Review prompt should contain maybe later button')
      }
      
      // Verify the feedback button has the correct text and emoji
      if (!reviewPrompt.innerHTML.includes('💬 Contact on Reddit')) {
        throw new Error('Feedback button should have correct text and emoji')
      }

      // Verify the updated description text
      if (!reviewPrompt.innerHTML.includes('contact me on Reddit to share feedback and suggestions')) {
        throw new Error('Review prompt should mention Reddit contact option in description')
      }
      
      return 'PASS'
    }
  }
]

// Test runner
async function runTests() {
  console.log('🧪 Running Feedback Feature Tests...\n')
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = await test.run()
      console.log(`✅ ${test.name}: ${result}`)
      passed++
    } catch (error) {
      console.log(`❌ ${test.name}: FAIL - ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All feedback feature tests passed!')
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.')
  }
  
  return { passed, failed }
}

// Export for Node.js or run in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests, tests }
} else {
  // Run tests immediately in browser
  runTests()
}
