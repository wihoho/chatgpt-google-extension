/**
 * Test validation script for the refactored ChatGPT for Google Calendar extension
 * This file contains test cases to validate the new functionality
 */

import { logger } from './logging'
import { shouldShowOnboarding, markOnboardingComplete } from './onboarding'

// Test data for event extraction
export const testEventTexts = [
  {
    input: "Team meeting tomorrow at 3 PM in the conference room",
    expected: {
      title: "Team meeting",
      location: "conference room",
      hasTime: true
    }
  },
  {
    input: "Doctor appointment next Friday at 2:30 PM at Main Street Clinic",
    expected: {
      title: "Doctor appointment",
      location: "Main Street Clinic",
      hasTime: true
    }
  },
  {
    input: "Christmas Day December 25th",
    expected: {
      title: "Christmas Day",
      hasTime: false
    }
  },
  {
    input: "Project deadline EOD Friday",
    expected: {
      title: "Project deadline",
      hasTime: true
    }
  },
  {
    input: "Conference call with client about Q4 results on Dec 15 from 10 AM to 11:30 AM",
    expected: {
      title: "Conference call with client about Q4 results",
      hasTime: true,
      hasEndTime: true
    }
  },
  {
    input: "random text with no event information",
    expected: {
      isEmpty: true
    }
  }
]

// Test cases for error handling
export const testErrorScenarios = [
  {
    scenario: "Invalid API key",
    errorMessage: "Invalid API key",
    expectedUserMessage: "Invalid API key. Please check your API key in the extension settings."
  },
  {
    scenario: "Rate limit exceeded",
    errorMessage: "rate limit exceeded",
    expectedUserMessage: "Rate limit exceeded. Please wait a moment and try again."
  },
  {
    scenario: "Network error",
    errorMessage: "network error",
    expectedUserMessage: "Network error. Please check your internet connection and try again."
  },
  {
    scenario: "Model not found",
    errorMessage: "model not found",
    expectedUserMessage: "The selected AI model is not available. Please try a different model in settings."
  }
]

/**
 * Validate the JSON parsing function
 */
export function testJSONParsing() {
  const testCases = [
    {
      input: '{"title": "Meeting", "startDate": "2024-12-05T15:00:00", "endDate": null, "location": "Zoom", "description": null}',
      shouldParse: true
    },
    {
      input: "Here's the event: {'title': 'Meeting', 'startDate': '2024-12-05T15:00:00'}",
      shouldParse: true // Should handle single quotes
    },
    {
      input: '{"title": "Meeting", "startDate": "2024-12-05T15:00:00",}', // Trailing comma
      shouldParse: true // Should handle trailing commas
    },
    {
      input: "No JSON here",
      shouldParse: false
    },
    {
      input: "{}",
      shouldParse: true // Empty object is valid
    }
  ]

  console.log("Testing JSON parsing...")
  // Note: The actual extractAndParseJSONFromString function would need to be imported
  // This is a placeholder for the test structure
}

/**
 * Validate date formatting
 */
export function testDateFormatting() {
  const testCases = [
    {
      input: "2024-12-05T15:00:00",
      expectedFormat: "20241205T150000Z", // Google Calendar format
      isAllDay: false
    },
    {
      input: "2024-12-25",
      expectedFormat: "20241225", // All-day format
      isAllDay: true
    },
    {
      input: null,
      expectedFormat: null
    },
    {
      input: "invalid-date",
      expectedFormat: null
    }
  ]

  console.log("Testing date formatting...")
  // Note: The actual formatDateTimeForGoogle function would need to be imported
}

/**
 * Test logging functionality
 */
export async function testLogging() {
  console.log("Testing logging functionality...")
  
  try {
    await logger.info('test', 'Test info message', { testData: 'value' })
    await logger.warn('test', 'Test warning message')
    await logger.error('test', 'Test error message', undefined, new Error('Test error'))
    
    const logs = await logger.getLogs(10)
    console.log(`Retrieved ${logs.length} log entries`)
    
    if (logs.length >= 3) {
      console.log("✓ Logging functionality working correctly")
      return true
    } else {
      console.log("✗ Logging functionality may have issues")
      return false
    }
  } catch (error) {
    console.error("✗ Logging test failed:", error)
    return false
  }
}

/**
 * Test onboarding functionality
 */
export async function testOnboarding() {
  console.log("Testing onboarding functionality...")
  
  try {
    // Test initial state
    const shouldShow1 = await shouldShowOnboarding()
    console.log(`Should show onboarding initially: ${shouldShow1}`)
    
    // Mark as complete
    await markOnboardingComplete()
    
    // Test after completion
    const shouldShow2 = await shouldShowOnboarding()
    console.log(`Should show onboarding after completion: ${shouldShow2}`)
    
    if (shouldShow1 && !shouldShow2) {
      console.log("✓ Onboarding functionality working correctly")
      return true
    } else {
      console.log("✗ Onboarding functionality may have issues")
      return false
    }
  } catch (error) {
    console.error("✗ Onboarding test failed:", error)
    return false
  }
}

/**
 * Test modal functionality
 */
export async function testModalFunctionality() {
  console.log("Testing modal functionality...")

  try {
    // Test if debug functions are available
    if (typeof window !== 'undefined' && (window as any).extensionDebug) {
      const debug = (window as any).extensionDebug

      // Test modal creation
      debug.testModal()
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait for creation

      const modalCheck = debug.checkModalExists()
      if (!modalCheck.overlayExists || !modalCheck.modalExists) {
        console.log("✗ Modal creation failed")
        return false
      }

      // Test event confirmation
      debug.testEventConfirmation()
      await new Promise(resolve => setTimeout(resolve, 500))

      // Clean up
      debug.hideModal()

      console.log("✓ Modal functionality working correctly")
      return true
    } else {
      console.log("✗ Extension debug functions not available (content script may not be loaded)")
      return false
    }
  } catch (error) {
    console.error("✗ Modal functionality test failed:", error)
    return false
  }
}

/**
 * Test message passing between background and content script
 */
export async function testMessagePassing() {
  console.log("Testing message passing...")

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Test background script communication
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({action: 'test'}, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(response)
          }
        })
      })

      console.log("✓ Message passing working correctly")
      return true
    } else {
      console.log("✗ Chrome extension APIs not available")
      return false
    }
  } catch (error) {
    console.error("✗ Message passing test failed:", error)
    return false
  }
}

/**
 * Run all validation tests
 */
export async function runAllTests() {
  console.log("Starting validation tests for ChatGPT for Google Calendar extension...")

  const results = {
    logging: await testLogging(),
    onboarding: await testOnboarding(),
    modal: await testModalFunctionality(),
    messagePassing: await testMessagePassing(),
  }

  const passedTests = Object.values(results).filter(Boolean).length
  const totalTests = Object.keys(results).length

  console.log(`\nTest Results: ${passedTests}/${totalTests} tests passed`)

  if (passedTests === totalTests) {
    console.log("✓ All tests passed! The extension refactor appears to be working correctly.")
  } else {
    console.log("✗ Some tests failed. Please review the implementation.")
  }

  return results
}

/**
 * Manual testing checklist
 */
export const manualTestingChecklist = [
  "1. Install the extension and verify onboarding appears",
  "2. Configure an API key in the AI Provider settings",
  "3. Test modal creation: Open console, run `extensionDebug.testModal()`",
  "4. Test event confirmation: Run `extensionDebug.testEventConfirmation()`",
  "5. Select text with event information on any webpage",
  "6. Right-click and select 'Add to calendar'",
  "7. Verify the confirmation modal appears with extracted event details",
  "8. Click 'Add to Calendar' and verify Google Calendar opens with pre-filled event",
  "9. Test with different types of event text (meetings, appointments, deadlines)",
  "10. Test error scenarios (invalid API key, network issues)",
  "11. Verify error messages are helpful and persistent until dismissed",
  "12. Check debug logs in the extension options",
  "13. Test switching between OpenAI and Gemini models",
  "14. Verify the extension works on different websites",
  "15. Test modal responsiveness: Ensure page doesn't become unresponsive",
  "16. Test modal cleanup: Verify modal disappears properly when cancelled"
]

/**
 * Debugging checklist for modal issues
 */
export const modalDebuggingChecklist = [
  "1. Check if content script is loaded: `typeof extensionDebug !== 'undefined'`",
  "2. Test modal creation: `extensionDebug.testModal()`",
  "3. Check modal existence: `extensionDebug.checkModalExists()`",
  "4. Check console for JavaScript errors",
  "5. Verify extension permissions in chrome://extensions/",
  "6. Check if page has Content Security Policy restrictions",
  "7. Test on different websites (some sites may block extension content)",
  "8. Check debug logs in extension options for detailed error information",
  "9. Verify API key is configured in extension settings",
  "10. Test with simple text first: 'Meeting tomorrow at 3 PM'"
]

// Export for use in browser console or testing environment
if (typeof window !== 'undefined') {
  (window as any).extensionTests = {
    runAllTests,
    testLogging,
    testOnboarding,
    testModalFunctionality,
    testMessagePassing,
    testEventTexts,
    testErrorScenarios,
    manualTestingChecklist,
    modalDebuggingChecklist
  }
}
