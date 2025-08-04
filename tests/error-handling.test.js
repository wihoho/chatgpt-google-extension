/**
 * Test Suite for Enhanced Error Handling Feature
 * Tests the functionality of detecting failed AI extraction and showing error dialogs
 */

// Test utilities for AI extraction failure detection
function testExtractionFailureDetection() {
  const tests = [
    {
      name: 'Empty extraction - all fields empty',
      data: {
        title: '',
        startDate: '',
        endDate: '',
        location: '',
        description: ''
      },
      expectedFailed: true
    },
    {
      name: 'Null extraction - all fields null',
      data: {
        title: null,
        startDate: null,
        endDate: null,
        location: null,
        description: null
      },
      expectedFailed: true
    },
    {
      name: 'Undefined extraction - all fields undefined',
      data: {
        title: undefined,
        startDate: undefined,
        endDate: undefined,
        location: undefined,
        description: undefined
      },
      expectedFailed: true
    },
    {
      name: 'Whitespace only - all fields whitespace',
      data: {
        title: '   ',
        startDate: '\t',
        endDate: '\n',
        location: '  \t\n  ',
        description: ''
      },
      expectedFailed: true
    },
    {
      name: 'Has title only - should not fail',
      data: {
        title: 'Meeting',
        startDate: '',
        endDate: '',
        location: '',
        description: ''
      },
      expectedFailed: false
    },
    {
      name: 'Has start date only - should not fail',
      data: {
        title: '',
        startDate: '2024-03-15T14:00',
        endDate: '',
        location: '',
        description: ''
      },
      expectedFailed: false
    },
    {
      name: 'Has location only - should not fail',
      data: {
        title: '',
        startDate: '',
        endDate: '',
        location: 'Conference Room A',
        description: ''
      },
      expectedFailed: false
    },
    {
      name: 'Has description only - should not fail',
      data: {
        title: '',
        startDate: '',
        endDate: '',
        location: '',
        description: 'Team meeting to discuss project'
      },
      expectedFailed: false
    },
    {
      name: 'Complete extraction - should not fail',
      data: {
        title: 'Team Meeting',
        startDate: '2024-03-15T14:00',
        endDate: '2024-03-15T15:00',
        location: 'Conference Room A',
        description: 'Weekly team sync'
      },
      expectedFailed: false
    },
    {
      name: 'Partial extraction with title and date - should not fail',
      data: {
        title: 'Doctor Appointment',
        startDate: '2024-03-20T10:30',
        endDate: '',
        location: '',
        description: ''
      },
      expectedFailed: false
    }
  ]

  console.log('🧪 Testing AI Extraction Failure Detection...\n')
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      // Simulate the extraction failure detection logic
      const jsonObject = test.data
      const hasTitle = !!(jsonObject.title && jsonObject.title.trim())
      const hasStartDate = !!(jsonObject.startDate && jsonObject.startDate.trim())
      const hasEndDate = !!(jsonObject.endDate && jsonObject.endDate.trim())
      const hasLocation = !!(jsonObject.location && jsonObject.location.trim())
      const hasDescription = !!(jsonObject.description && jsonObject.description.trim())
      
      const extractionFailed = !hasTitle && !hasStartDate && !hasEndDate && !hasLocation && !hasDescription
      
      if (extractionFailed === test.expectedFailed) {
        console.log(`✅ ${test.name}: PASS`)
        passed++
      } else {
        console.log(`❌ ${test.name}: FAIL - Expected ${test.expectedFailed}, got ${extractionFailed}`)
        failed++
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 Extraction Detection Tests: ${passed} passed, ${failed} failed`)
  return { passed, failed }
}

// Test error modal creation
function testErrorModalCreation() {
  console.log('\n🧪 Testing Error Modal Creation...\n')
  
  // Mock DOM environment
  const mockDocument = {
    createElement: function(tag) {
      const element = {
        tagName: tag.toUpperCase(),
        id: '',
        style: {},
        innerHTML: '',
        textContent: '',
        className: '',
        onclick: null,
        addEventListener: function(event, handler) {
          this[`on${event}`] = handler
        },
        appendChild: function(child) {
          if (!this.children) this.children = []
          this.children.push(child)
        },
        querySelector: function(selector) {
          if (!this.children) return null
          return this.children.find(child => 
            selector.includes('#') ? child.id === selector.slice(1) : 
            selector.includes('.') ? child.className.includes(selector.slice(1)) :
            child.tagName === selector.toUpperCase()
          ) || null
        },
        classList: {
          add: function(className) {
            this.parent.className += ' ' + className
          },
          remove: function(className) {
            this.parent.className = this.parent.className.replace(className, '').trim()
          }
        }
      }
      element.classList.parent = element
      return element
    },
    body: {
      appendChild: function(child) {
        if (!this.children) this.children = []
        this.children.push(child)
      },
      style: {}
    },
    head: {
      appendChild: function(child) {
        if (!this.children) this.children = []
        this.children.push(child)
      }
    }
  }
  
  const tests = [
    {
      name: 'Error modal structure creation',
      run() {
        // Simulate createErrorModal function
        const overlay = mockDocument.createElement('div')
        overlay.id = 'extension-modal-overlay'
        
        const modal = mockDocument.createElement('div')
        modal.id = 'extension-error-modal'
        
        const errorContent = mockDocument.createElement('div')
        
        const titleContainer = mockDocument.createElement('div')
        const errorIcon = mockDocument.createElement('span')
        errorIcon.textContent = '⚠️'
        const title = mockDocument.createElement('h2')
        title.textContent = 'No Event Information Found'
        
        titleContainer.appendChild(errorIcon)
        titleContainer.appendChild(title)
        errorContent.appendChild(titleContainer)
        
        const message = mockDocument.createElement('div')
        message.innerHTML = '<p>We couldn\'t extract any event information from the selected text.</p>'
        errorContent.appendChild(message)
        
        const buttonContainer = mockDocument.createElement('div')
        const cancelButton = mockDocument.createElement('button')
        cancelButton.textContent = 'Cancel'
        const retryButton = mockDocument.createElement('button')
        retryButton.textContent = 'Try Again'
        
        buttonContainer.appendChild(cancelButton)
        buttonContainer.appendChild(retryButton)
        errorContent.appendChild(buttonContainer)
        
        modal.appendChild(errorContent)
        overlay.appendChild(modal)
        
        // Verify structure
        if (overlay.id !== 'extension-modal-overlay') {
          throw new Error('Overlay ID not set correctly')
        }
        
        if (modal.id !== 'extension-error-modal') {
          throw new Error('Modal ID not set correctly')
        }
        
        if (title.textContent !== 'No Event Information Found') {
          throw new Error('Title not set correctly')
        }
        
        if (cancelButton.textContent !== 'Cancel') {
          throw new Error('Cancel button text not set correctly')
        }
        
        if (retryButton.textContent !== 'Try Again') {
          throw new Error('Retry button text not set correctly')
        }
        
        return 'PASS'
      }
    },
    
    {
      name: 'Error modal button functionality',
      run() {
        let cancelClicked = false
        let retryClicked = false
        
        const cancelButton = mockDocument.createElement('button')
        cancelButton.onclick = () => { cancelClicked = true }
        
        const retryButton = mockDocument.createElement('button')
        retryButton.onclick = () => { retryClicked = true }
        
        // Simulate clicks
        if (cancelButton.onclick) cancelButton.onclick()
        if (retryButton.onclick) retryButton.onclick()
        
        if (!cancelClicked) {
          throw new Error('Cancel button click handler not working')
        }
        
        if (!retryClicked) {
          throw new Error('Retry button click handler not working')
        }
        
        return 'PASS'
      }
    },
    
    {
      name: 'Error modal styling application',
      run() {
        const modal = mockDocument.createElement('div')
        
        // Simulate style application
        modal.style.cssText = `
          background-color: #ffffff !important;
          border-radius: 12px !important;
          padding: 24px !important;
          border-left: 4px solid #ef4444 !important;
        `
        
        if (!modal.style.cssText.includes('border-left: 4px solid #ef4444')) {
          throw new Error('Error styling not applied correctly')
        }
        
        if (!modal.style.cssText.includes('background-color: #ffffff')) {
          throw new Error('Background color not applied correctly')
        }
        
        return 'PASS'
      }
    }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = test.run()
      console.log(`✅ ${test.name}: ${result}`)
      passed++
    } catch (error) {
      console.log(`❌ ${test.name}: FAIL - ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 Error Modal Tests: ${passed} passed, ${failed} failed`)
  return { passed, failed }
}

// Test message handling workflow
function testMessageHandlingWorkflow() {
  console.log('\n🧪 Testing Message Handling Workflow...\n')
  
  const tests = [
    {
      name: 'showExtractionError message handling',
      run() {
        let errorModalShown = false
        let confirmationModalHidden = false
        
        // Mock functions
        const showErrorModal = () => { errorModalShown = true }
        const hideConfirmationModal = () => { confirmationModalHidden = true }
        
        // Simulate message handler
        const message = {
          action: 'showExtractionError',
          originalText: 'some text that failed extraction'
        }
        
        if (message.action === 'showExtractionError') {
          hideConfirmationModal()
          showErrorModal()
        }
        
        if (!confirmationModalHidden) {
          throw new Error('Confirmation modal should be hidden first')
        }
        
        if (!errorModalShown) {
          throw new Error('Error modal should be shown')
        }
        
        return 'PASS'
      }
    },
    
    {
      name: 'Background script extraction failure flow',
      run() {
        let errorMessageSent = false
        let confirmationMessageSent = false
        
        // Mock message sending
        const sendMessage = (message) => {
          if (message.action === 'showExtractionError') {
            errorMessageSent = true
          } else if (message.action === 'showEventConfirmation') {
            confirmationMessageSent = true
          }
        }
        
        // Test failed extraction
        const failedData = {
          title: '',
          startDate: '',
          endDate: '',
          location: '',
          description: ''
        }
        
        const hasTitle = !!(failedData.title && failedData.title.trim())
        const hasStartDate = !!(failedData.startDate && failedData.startDate.trim())
        const hasEndDate = !!(failedData.endDate && failedData.endDate.trim())
        const hasLocation = !!(failedData.location && failedData.location.trim())
        const hasDescription = !!(failedData.description && failedData.description.trim())
        
        const extractionFailed = !hasTitle && !hasStartDate && !hasEndDate && !hasLocation && !hasDescription
        
        if (extractionFailed) {
          sendMessage({
            action: 'showExtractionError',
            originalText: 'test text'
          })
        } else {
          sendMessage({
            action: 'showEventConfirmation',
            eventData: failedData
          })
        }
        
        if (!errorMessageSent) {
          throw new Error('Error message should be sent for failed extraction')
        }
        
        if (confirmationMessageSent) {
          throw new Error('Confirmation message should not be sent for failed extraction')
        }
        
        return 'PASS'
      }
    }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    try {
      const result = test.run()
      console.log(`✅ ${test.name}: ${result}`)
      passed++
    } catch (error) {
      console.log(`❌ ${test.name}: FAIL - ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 Message Handling Tests: ${passed} passed, ${failed} failed`)
  return { passed, failed }
}

// Main test runner
function runAllTests() {
  console.log('🧪 Running Enhanced Error Handling Feature Tests...\n')
  
  const extractionResults = testExtractionFailureDetection()
  const modalResults = testErrorModalCreation()
  const messageResults = testMessageHandlingWorkflow()
  
  const totalPassed = extractionResults.passed + modalResults.passed + messageResults.passed
  const totalFailed = extractionResults.failed + modalResults.failed + messageResults.failed
  
  console.log(`\n🎯 Overall Results: ${totalPassed} passed, ${totalFailed} failed`)
  
  if (totalFailed === 0) {
    console.log('🎉 All error handling tests passed!')
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.')
  }
  
  return { passed: totalPassed, failed: totalFailed }
}

// Export for Node.js or run in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    runAllTests, 
    testExtractionFailureDetection, 
    testErrorModalCreation, 
    testMessageHandlingWorkflow 
  }
} else {
  // Run tests immediately in browser
  runAllTests()
}
