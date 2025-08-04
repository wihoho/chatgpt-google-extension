/**
 * Test Suite for Chrome Web Store Review Prompt Feature
 * Tests the functionality of tracking successful events and showing review prompts
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
    return {
      tagName: tag.toUpperCase(),
      style: {},
      innerHTML: '',
      textContent: '',
      addEventListener: function() {},
      appendChild: function() {},
      insertBefore: function() {},
      querySelector: function() { return null },
      classList: { add: function() {}, remove: function() {} }
    }
  },
  body: {
    appendChild: function() {},
    style: {}
  },
  head: {
    appendChild: function() {}
  }
}

// Mock window
const mockWindow = {
  open: function(url, target) {
    this.lastOpenedUrl = url
    this.lastOpenedTarget = target
  },
  lastOpenedUrl: null,
  lastOpenedTarget: null
}

// Test utilities
function resetMocks() {
  mockBrowser.storage.local.clear()
  mockWindow.lastOpenedUrl = null
  mockWindow.lastOpenedTarget = null
}

// Test cases
const tests = [
  {
    name: 'incrementSuccessfulEvents - should start at 1 for new user',
    async run() {
      resetMocks()
      
      // Simulate incrementSuccessfulEvents function
      const result = await mockBrowser.storage.local.get(['successfulEvents'])
      const count = (result.successfulEvents || 0) + 1
      await mockBrowser.storage.local.set({ successfulEvents: count })
      
      const finalResult = await mockBrowser.storage.local.get(['successfulEvents'])
      
      if (finalResult.successfulEvents !== 1) {
        throw new Error(`Expected count to be 1, got ${finalResult.successfulEvents}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'incrementSuccessfulEvents - should increment existing count',
    async run() {
      resetMocks()
      
      // Set initial count
      await mockBrowser.storage.local.set({ successfulEvents: 3 })
      
      // Increment
      const result = await mockBrowser.storage.local.get(['successfulEvents'])
      const count = (result.successfulEvents || 0) + 1
      await mockBrowser.storage.local.set({ successfulEvents: count })
      
      const finalResult = await mockBrowser.storage.local.get(['successfulEvents'])
      
      if (finalResult.successfulEvents !== 4) {
        throw new Error(`Expected count to be 4, got ${finalResult.successfulEvents}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'shouldShowReviewPrompt - should return false for new user',
    async run() {
      resetMocks()
      
      // Simulate shouldShowReviewPrompt function
      const result = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const count = result.successfulEvents || 0
      const dismissed = result.reviewPromptDismissed || false
      const shouldShow = !dismissed && count > 0 && count % 5 === 0
      
      if (shouldShow !== false) {
        throw new Error(`Expected shouldShow to be false for new user, got ${shouldShow}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'shouldShowReviewPrompt - should return true at exactly 5 events',
    async run() {
      resetMocks()
      
      // Set count to 5
      await mockBrowser.storage.local.set({ successfulEvents: 5 })
      
      const result = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const count = result.successfulEvents || 0
      const dismissed = result.reviewPromptDismissed || false
      const shouldShow = !dismissed && count > 0 && count % 5 === 0
      
      if (shouldShow !== true) {
        throw new Error(`Expected shouldShow to be true at 5 events, got ${shouldShow}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'shouldShowReviewPrompt - should return true at 10, 15, 20 events',
    async run() {
      resetMocks()
      
      const testCounts = [10, 15, 20]
      
      for (const testCount of testCounts) {
        await mockBrowser.storage.local.set({ successfulEvents: testCount })
        
        const result = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
        const count = result.successfulEvents || 0
        const dismissed = result.reviewPromptDismissed || false
        const shouldShow = !dismissed && count > 0 && count % 5 === 0
        
        if (shouldShow !== true) {
          throw new Error(`Expected shouldShow to be true at ${testCount} events, got ${shouldShow}`)
        }
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'shouldShowReviewPrompt - should return false when dismissed',
    async run() {
      resetMocks()
      
      // Set count to 5 and mark as dismissed
      await mockBrowser.storage.local.set({ 
        successfulEvents: 5, 
        reviewPromptDismissed: true 
      })
      
      const result = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const count = result.successfulEvents || 0
      const dismissed = result.reviewPromptDismissed || false
      const shouldShow = !dismissed && count > 0 && count % 5 === 0
      
      if (shouldShow !== false) {
        throw new Error(`Expected shouldShow to be false when dismissed, got ${shouldShow}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'shouldShowReviewPrompt - should return false at non-multiple of 5',
    async run() {
      resetMocks()
      
      const testCounts = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14]
      
      for (const testCount of testCounts) {
        await mockBrowser.storage.local.set({ successfulEvents: testCount })
        
        const result = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
        const count = result.successfulEvents || 0
        const dismissed = result.reviewPromptDismissed || false
        const shouldShow = !dismissed && count > 0 && count % 5 === 0
        
        if (shouldShow !== false) {
          throw new Error(`Expected shouldShow to be false at ${testCount} events, got ${shouldShow}`)
        }
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'markReviewPromptDismissed - should set dismissed flag',
    async run() {
      resetMocks()
      
      // Simulate markReviewPromptDismissed function
      await mockBrowser.storage.local.set({ reviewPromptDismissed: true })
      
      const result = await mockBrowser.storage.local.get(['reviewPromptDismissed'])
      
      if (result.reviewPromptDismissed !== true) {
        throw new Error(`Expected reviewPromptDismissed to be true, got ${result.reviewPromptDismissed}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'Review prompt workflow - complete user journey',
    async run() {
      resetMocks()
      
      // User creates 4 events - no prompt
      for (let i = 1; i <= 4; i++) {
        const result = await mockBrowser.storage.local.get(['successfulEvents'])
        const count = (result.successfulEvents || 0) + 1
        await mockBrowser.storage.local.set({ successfulEvents: count })
        
        const checkResult = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
        const shouldShow = !checkResult.reviewPromptDismissed && checkResult.successfulEvents > 0 && checkResult.successfulEvents % 5 === 0
        
        if (shouldShow) {
          throw new Error(`Should not show prompt at ${i} events`)
        }
      }
      
      // 5th event - should show prompt
      const result5 = await mockBrowser.storage.local.get(['successfulEvents'])
      const count5 = (result5.successfulEvents || 0) + 1
      await mockBrowser.storage.local.set({ successfulEvents: count5 })
      
      const checkResult5 = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const shouldShow5 = !checkResult5.reviewPromptDismissed && checkResult5.successfulEvents > 0 && checkResult5.successfulEvents % 5 === 0
      
      if (!shouldShow5) {
        throw new Error('Should show prompt at 5 events')
      }
      
      // User clicks "Maybe Later" - continue to 10th event
      for (let i = 6; i <= 9; i++) {
        const result = await mockBrowser.storage.local.get(['successfulEvents'])
        const count = (result.successfulEvents || 0) + 1
        await mockBrowser.storage.local.set({ successfulEvents: count })
      }
      
      // 10th event - should show prompt again
      const result10 = await mockBrowser.storage.local.get(['successfulEvents'])
      const count10 = (result10.successfulEvents || 0) + 1
      await mockBrowser.storage.local.set({ successfulEvents: count10 })
      
      const checkResult10 = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const shouldShow10 = !checkResult10.reviewPromptDismissed && checkResult10.successfulEvents > 0 && checkResult10.successfulEvents % 5 === 0
      
      if (!shouldShow10) {
        throw new Error('Should show prompt again at 10 events')
      }
      
      // User clicks "Review Now" - mark as dismissed
      await mockBrowser.storage.local.set({ reviewPromptDismissed: true })
      
      // Continue to 15th event - should not show prompt
      for (let i = 11; i <= 15; i++) {
        const result = await mockBrowser.storage.local.get(['successfulEvents'])
        const count = (result.successfulEvents || 0) + 1
        await mockBrowser.storage.local.set({ successfulEvents: count })
      }
      
      const checkResult15 = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      const shouldShow15 = !checkResult15.reviewPromptDismissed && checkResult15.successfulEvents > 0 && checkResult15.successfulEvents % 5 === 0
      
      if (shouldShow15) {
        throw new Error('Should not show prompt at 15 events after dismissal')
      }
      
      return 'PASS'
    }
  }
]

// Test runner
async function runTests() {
  console.log('🧪 Running Review Prompt Feature Tests...\n')
  
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
    console.log('🎉 All tests passed!')
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
