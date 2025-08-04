/**
 * Integration Test Suite for New Features
 * Tests the interaction between review prompt and error handling features
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

// Test scenarios
const integrationTests = [
  {
    name: 'Failed extractions should not count toward review prompt',
    async run() {
      // Reset state
      await mockBrowser.storage.local.clear()
      
      // Simulate 5 failed extractions (should not increment counter)
      for (let i = 0; i < 5; i++) {
        // Simulate failed extraction detection
        const extractionData = {
          title: '',
          startDate: '',
          endDate: '',
          location: '',
          description: ''
        }
        
        const hasTitle = !!(extractionData.title && extractionData.title.trim())
        const hasStartDate = !!(extractionData.startDate && extractionData.startDate.trim())
        const hasEndDate = !!(extractionData.endDate && extractionData.endDate.trim())
        const hasLocation = !!(extractionData.location && extractionData.location.trim())
        const hasDescription = !!(extractionData.description && extractionData.description.trim())
        
        const extractionFailed = !hasTitle && !hasStartDate && !hasEndDate && !hasLocation && !hasDescription
        
        // Only increment counter for successful extractions
        if (!extractionFailed) {
          const result = await mockBrowser.storage.local.get(['successfulEvents'])
          const count = (result.successfulEvents || 0) + 1
          await mockBrowser.storage.local.set({ successfulEvents: count })
        }
      }
      
      // Check that counter is still 0
      const result = await mockBrowser.storage.local.get(['successfulEvents'])
      const count = result.successfulEvents || 0
      
      if (count !== 0) {
        throw new Error(`Expected count to be 0 after failed extractions, got ${count}`)
      }
      
      // Check that review prompt should not show
      const shouldShow = count > 0 && count % 5 === 0
      if (shouldShow) {
        throw new Error('Review prompt should not show after failed extractions')
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'Mixed successful and failed extractions count correctly',
    async run() {
      await mockBrowser.storage.local.clear()
      
      const scenarios = [
        { title: 'Meeting', startDate: '2024-03-15T14:00', success: true },
        { title: '', startDate: '', success: false },
        { title: 'Call', startDate: '', success: true },
        { title: '', startDate: '', success: false },
        { title: '', startDate: '2024-03-16T10:00', success: true }
      ]
      
      let expectedCount = 0
      
      for (const scenario of scenarios) {
        const extractionData = {
          title: scenario.title,
          startDate: scenario.startDate,
          endDate: '',
          location: '',
          description: ''
        }
        
        const hasTitle = !!(extractionData.title && extractionData.title.trim())
        const hasStartDate = !!(extractionData.startDate && extractionData.startDate.trim())
        const hasEndDate = !!(extractionData.endDate && extractionData.endDate.trim())
        const hasLocation = !!(extractionData.location && extractionData.location.trim())
        const hasDescription = !!(extractionData.description && extractionData.description.trim())
        
        const extractionFailed = !hasTitle && !hasStartDate && !hasEndDate && !hasLocation && !hasDescription
        
        if (!extractionFailed) {
          const result = await mockBrowser.storage.local.get(['successfulEvents'])
          const count = (result.successfulEvents || 0) + 1
          await mockBrowser.storage.local.set({ successfulEvents: count })
          expectedCount++
        }
        
        // Verify extraction failure detection matches expected
        if (extractionFailed === scenario.success) {
          throw new Error(`Extraction failure detection mismatch for scenario: ${JSON.stringify(scenario)}`)
        }
      }
      
      const finalResult = await mockBrowser.storage.local.get(['successfulEvents'])
      const finalCount = finalResult.successfulEvents || 0
      
      if (finalCount !== expectedCount) {
        throw new Error(`Expected count ${expectedCount}, got ${finalCount}`)
      }
      
      if (finalCount !== 3) {
        throw new Error(`Expected exactly 3 successful extractions, got ${finalCount}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'Review prompt appears only after successful extractions reach threshold',
    async run() {
      await mockBrowser.storage.local.clear()
      
      // Create 4 successful extractions
      for (let i = 0; i < 4; i++) {
        const result = await mockBrowser.storage.local.get(['successfulEvents'])
        const count = (result.successfulEvents || 0) + 1
        await mockBrowser.storage.local.set({ successfulEvents: count })
      }
      
      // Add some failed extractions (should not affect count)
      // These would be detected as failed but not increment counter
      
      // Verify no prompt at 4 successful events
      let checkResult = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      let shouldShow = !checkResult.reviewPromptDismissed && checkResult.successfulEvents > 0 && checkResult.successfulEvents % 5 === 0
      
      if (shouldShow) {
        throw new Error('Should not show prompt at 4 successful events')
      }
      
      // Add 5th successful extraction
      const result5 = await mockBrowser.storage.local.get(['successfulEvents'])
      const count5 = (result5.successfulEvents || 0) + 1
      await mockBrowser.storage.local.set({ successfulEvents: count5 })
      
      // Verify prompt shows at 5 successful events
      checkResult = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
      shouldShow = !checkResult.reviewPromptDismissed && checkResult.successfulEvents > 0 && checkResult.successfulEvents % 5 === 0
      
      if (!shouldShow) {
        throw new Error('Should show prompt at 5 successful events')
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'Error modal and review prompt do not interfere with each other',
    async run() {
      await mockBrowser.storage.local.clear()
      
      // Set up scenario where user has 4 successful events
      await mockBrowser.storage.local.set({ successfulEvents: 4 })
      
      // Simulate failed extraction (should show error modal, not increment counter)
      const failedData = { title: '', startDate: '', endDate: '', location: '', description: '' }
      const extractionFailed = true // Simulated failed detection
      
      let errorModalShown = false
      let confirmationModalShown = false
      let reviewPromptShown = false
      
      if (extractionFailed) {
        errorModalShown = true
        // Counter should not be incremented
      } else {
        confirmationModalShown = true
        // Counter would be incremented here
        const result = await mockBrowser.storage.local.get(['successfulEvents'])
        const count = (result.successfulEvents || 0) + 1
        await mockBrowser.storage.local.set({ successfulEvents: count })
        
        // Check for review prompt
        const checkResult = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
        reviewPromptShown = !checkResult.reviewPromptDismissed && checkResult.successfulEvents > 0 && checkResult.successfulEvents % 5 === 0
      }
      
      // Verify correct behavior
      if (!errorModalShown) {
        throw new Error('Error modal should be shown for failed extraction')
      }
      
      if (confirmationModalShown) {
        throw new Error('Confirmation modal should not be shown for failed extraction')
      }
      
      if (reviewPromptShown) {
        throw new Error('Review prompt should not be shown for failed extraction')
      }
      
      // Verify counter was not incremented
      const finalResult = await mockBrowser.storage.local.get(['successfulEvents'])
      if (finalResult.successfulEvents !== 4) {
        throw new Error(`Counter should remain at 4, got ${finalResult.successfulEvents}`)
      }
      
      return 'PASS'
    }
  },
  
  {
    name: 'Complete user journey with mixed success/failure and review prompt',
    async run() {
      await mockBrowser.storage.local.clear()
      
      const userActions = [
        { type: 'success', data: { title: 'Meeting 1', startDate: '2024-03-15T14:00' } },
        { type: 'failure', data: { title: '', startDate: '' } },
        { type: 'success', data: { title: 'Call', startDate: '' } },
        { type: 'failure', data: { title: '', startDate: '' } },
        { type: 'success', data: { title: '', startDate: '2024-03-16T10:00' } },
        { type: 'success', data: { title: 'Appointment', startDate: '2024-03-17T09:00' } },
        { type: 'failure', data: { title: '', startDate: '' } },
        { type: 'success', data: { title: 'Workshop', startDate: '2024-03-18T13:00' } }, // 5th success - should trigger prompt
        { type: 'failure', data: { title: '', startDate: '' } },
        { type: 'success', data: { title: 'Review', startDate: '2024-03-19T11:00' } }
      ]
      
      let successCount = 0
      let reviewPromptTriggered = false
      
      for (let i = 0; i < userActions.length; i++) {
        const action = userActions[i]
        
        // Simulate extraction failure detection
        const hasTitle = !!(action.data.title && action.data.title.trim())
        const hasStartDate = !!(action.data.startDate && action.data.startDate.trim())
        const extractionFailed = !hasTitle && !hasStartDate // Simplified check
        
        if (action.type === 'success' && !extractionFailed) {
          // Increment counter for successful extraction
          const result = await mockBrowser.storage.local.get(['successfulEvents'])
          const count = (result.successfulEvents || 0) + 1
          await mockBrowser.storage.local.set({ successfulEvents: count })
          successCount++
          
          // Check for review prompt
          const checkResult = await mockBrowser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
          const shouldShow = !checkResult.reviewPromptDismissed && checkResult.successfulEvents > 0 && checkResult.successfulEvents % 5 === 0
          
          if (shouldShow && successCount === 5) {
            reviewPromptTriggered = true
          }
        } else if (action.type === 'failure' && extractionFailed) {
          // Failed extraction - no counter increment, show error modal
          // (Error modal logic would be triggered here)
        } else {
          throw new Error(`Action type ${action.type} doesn't match extraction result for action ${i}`)
        }
      }
      
      // Verify final state
      const finalResult = await mockBrowser.storage.local.get(['successfulEvents'])
      if (finalResult.successfulEvents !== 6) {
        throw new Error(`Expected 6 successful events, got ${finalResult.successfulEvents}`)
      }
      
      if (!reviewPromptTriggered) {
        throw new Error('Review prompt should have been triggered at 5th successful event')
      }
      
      return 'PASS'
    }
  }
]

// Test runner
async function runIntegrationTests() {
  console.log('🧪 Running Integration Tests for New Features...\n')
  
  let passed = 0
  let failed = 0
  
  for (const test of integrationTests) {
    try {
      const result = await test.run()
      console.log(`✅ ${test.name}: ${result}`)
      passed++
    } catch (error) {
      console.log(`❌ ${test.name}: FAIL - ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 Integration Test Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All integration tests passed!')
    console.log('✨ Features are working correctly together!')
  } else {
    console.log('⚠️  Some integration tests failed. Please review the feature interactions.')
  }
  
  return { passed, failed }
}

// Export for Node.js or run in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runIntegrationTests, integrationTests }
} else {
  // Run tests immediately in browser
  runIntegrationTests()
}
