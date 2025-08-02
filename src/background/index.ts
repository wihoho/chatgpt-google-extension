import Browser, { Menus, Tabs } from 'webextension-polyfill'
import { getProvider, getProviderConfigs, getKeyConfigInfo, ProviderType } from '../config'
import { logger, ErrorTracker, setupGlobalErrorHandling } from '../logging'
import { checkFirstTimeUse } from '../onboarding'

// Setup global error handling for background script
setupGlobalErrorHandling('background')

// Check for first-time use on startup
Browser.runtime.onStartup.addListener(async () => {
  await checkFirstTimeUse()
})

Browser.runtime.onInstalled.addListener(async (details) => {
  // Always recreate context menu on install/update
  await createContextMenu()

  if (details.reason === 'install') {
    logger.info('background', 'Extension installed for the first time')
    await checkFirstTimeUse()
    // Optionally open options page on first install
    Browser.runtime.openOptionsPage()
  } else if (details.reason === 'update') {
    logger.info('background', 'Extension updated', {
      previousVersion: details.previousVersion,
      currentVersion: Browser.runtime.getManifest().version
    })
  }
})

// Define the context menu properties
const contextMenuProperties: Menus.CreateCreatePropertiesType = {
  id: 'add-to-calendar',
  title: 'Add to calendar',
  contexts: ['page', 'selection'], // Contexts where the menu will appear
}

// Create the context menu item with error handling
async function createContextMenu() {
  try {
    // Remove existing menu item if it exists
    await Browser.contextMenus.removeAll()

    // Create the new menu item
    await Browser.contextMenus.create(contextMenuProperties)
    logger.info('background', 'Context menu created successfully')
  } catch (error) {
    logger.error('background', 'Failed to create context menu', undefined, error as Error)
  }
}

// Initialize context menu
createContextMenu()

// Notification helper function
async function showNotification(title: string, message: string, type: 'basic' | 'progress' = 'basic') {
  try {
    await Browser.notifications.create({
      type: type,
      iconUrl: 'logo.png',
      title: title,
      message: message
    })
    logger.debug('background', 'Notification shown', { title, message })
  } catch (error) {
    logger.warn('background', 'Failed to show notification', { title, message }, error as Error)
  }
}

// Define a function to open a new window
async function openNewWindow(url: string) {
  try {
    // Create a new window
    const windowInfo = await Browser.windows.create({
      url: url,
    })

    // Log the window information (optional)
    console.log('New window created:', windowInfo)
  } catch (error) {
    console.error('Error opening a new window:', error)
  }
}

// In your JavaScript code, get the current date formatted as YYYY-MM-DD
const currentDate = new Date().toISOString().split('T')[0]; // e.g., "2024-07-26"

// Enhanced prompt template with better examples and structure
const promptTemplate = `
Extract event details from the following text and provide the output in a structured JSON format.

**Context:**
- Reference Date: ${currentDate} (use this as "today" for interpreting relative dates)
- Current Year: ${new Date().getFullYear()} (use for dates without specified year)

**Required Output Format:**
Return ONLY a JSON object with these exact keys: "title", "startDate", "endDate", "location", "description"
- Use null for missing values (not empty strings)
- Do not include any text before or after the JSON object

**Date/Time Format Rules:**
- Specific times: "YYYY-MM-DDTHH:mm:ss" (no timezone suffixes)
- All-day events: "YYYY-MM-DD"
- If start time exists but no end time: add 1 hour to start time
- If only start date exists: use same date for end date
- For relative dates (tomorrow, next week, etc.): calculate based on reference date
- For dates without year: use current year or next occurrence if date has passed

**Examples:**

Input: "Team meeting Thursday 3 PM Zoom"
Output: {"title": "Team meeting", "startDate": "2024-12-05T15:00:00", "endDate": "2024-12-05T16:00:00", "location": "Zoom", "description": null}

Input: "Project deadline: EOD Friday"
Output: {"title": "Project deadline", "startDate": "2024-12-06T17:00:00", "endDate": "2024-12-06T17:00:00", "location": null, "description": "Project deadline: EOD Friday"}

Input: "Doctor appointment tomorrow at 2:30 PM at Main Street Clinic"
Output: {"title": "Doctor appointment", "startDate": "2024-12-03T14:30:00", "endDate": "2024-12-03T15:30:00", "location": "Main Street Clinic", "description": null}

Input: "Christmas Day"
Output: {"title": "Christmas Day", "startDate": "2024-12-25", "endDate": "2024-12-25", "location": null, "description": null}

Input: "Conference call with client about Q4 results on Dec 15 from 10 AM to 11:30 AM"
Output: {"title": "Conference call with client about Q4 results", "startDate": "2024-12-15T10:00:00", "endDate": "2024-12-15T11:30:00", "location": null, "description": "Conference call with client about Q4 results"}

Input: "random text with no event information"
Output: {}

**Text to process:**
\${text}
`


async function extractDate(info: string, tabId: number | undefined) {
  const startTime = Date.now()

  if (!tabId) {
    logger.error('background', 'Cannot process request: No valid tab ID provided.')
    return
  }

  logger.info('background', 'Starting event extraction', {
    textLength: info.length,
    tabId,
    selectedText: info.substring(0, 100) + (info.length > 100 ? '...' : '')
  })

  let resultAccumulator = ''
  let processingError: Error | null = null
  let modalShown = false

  try {
    // Show confirmation modal with loading state
    try {
      logger.debug('background', `Sending showModal to tab ${tabId}`)

      // First check if the tab exists and is accessible
      const tab = await Browser.tabs.get(tabId)
      if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error(`Cannot inject content script into tab ${tabId}: ${tab?.url || 'unknown URL'}`)
      }

      await Browser.tabs.sendMessage(tabId, { action: 'showModal' })
      modalShown = true
      logger.debug('background', 'showModal message sent successfully')
    } catch (error: any) {
      logger.error('background', `Could not send showModal message to tab ${tabId}`, {
        tabId,
        errorMessage: error.message,
        errorName: error.name
      }, error)
      modalShown = false

      // If we can't show the modal, we should show an error immediately
      await showNotification(
        'Extension Error',
        'Cannot display confirmation modal. Please refresh the page and try again.'
      )
      processingError = new Error('Cannot display confirmation modal. Please try refreshing the page and try again.')
      return // Exit early since we can't show the modal
    }

    // --- Core Processing Logic ---
    const provider = await getProvider()
    const fullPrompt = promptTemplate.replace('${text}', info)

    // Get provider details for logging
    const providerName = provider.constructor.name
    const isGeminiProvider = providerName === 'GeminiProvider'
    const isOpenAIProvider = providerName === 'OpenAIProvider'

    logger.info('background', 'AI Provider selected and initialized', {
      providerType: providerName,
      isGemini: isGeminiProvider,
      isOpenAI: isOpenAIProvider,
      selectedText: info.substring(0, 100) + (info.length > 100 ? '...' : ''),
      promptLength: fullPrompt.length
    })

    logger.debug('background', 'Starting AI processing', {
      promptLength: fullPrompt.length,
      provider: providerName,
      textToProcess: info
    })

    await provider.generateAnswer({
      prompt: fullPrompt,
      onEvent: async (event) => {
        logger.debug('background', 'Provider Event received', { eventType: event.type })

        if (event.type === 'answer') {
          resultAccumulator = event.data.text
        } else if (event.type === 'done') {
          // --- Process Result ---
          logger.info('background', 'Raw AI Output received', {
            outputLength: resultAccumulator.length,
            output: resultAccumulator.substring(0, 200) + (resultAccumulator.length > 200 ? '...' : '')
          })

          let jsonObject = extractAndParseJSONFromString(resultAccumulator)
          logger.info('background', 'Parsed JSON Object', { jsonObject })

          // Handle cases where AI returns empty or invalid JSON
          if (!jsonObject || typeof jsonObject !== 'object') {
            logger.warn('background', 'AI returned invalid JSON, creating empty event template', {
              rawOutput: resultAccumulator,
              parsedObject: jsonObject
            })
            // Create empty template for user to fill in
            jsonObject = {
              title: '',
              startDate: '',
              endDate: '',
              location: '',
              description: ''
            }
          }

          // Ensure all required fields exist (even if empty)
          jsonObject = {
            title: jsonObject.title || '',
            startDate: jsonObject.startDate || '',
            endDate: jsonObject.endDate || '',
            location: jsonObject.location || '',
            description: jsonObject.description || '',
            originalText: info
          }

          logger.info('background', 'Event data prepared for confirmation', {
            extractedFields: Object.keys(jsonObject).filter(key => jsonObject[key] && key !== 'originalText'),
            emptyFields: Object.keys(jsonObject).filter(key => !jsonObject[key] && key !== 'originalText')
          })

          // Use the prepared event data (already includes all fields)
          const eventData = jsonObject

          // Send event data to content script for confirmation
          if (modalShown) {
            logger.debug('background', 'Sending event confirmation to content script', { tabId, eventData })
            Browser.tabs.sendMessage(tabId, {
              action: 'showEventConfirmation',
              eventData: eventData
            }).then(() => {
              logger.info('background', 'Event confirmation sent to content script successfully', {
                tabId,
                eventTitle: eventData.title,
                eventStartDate: eventData.startDate
              })

              // Track successful extraction
              const processingTime = Date.now() - startTime
              ErrorTracker.trackPerformance('background', 'event_extraction', processingTime, {
                textLength: info.length,
                hasTitle: !!jsonObject.title,
                hasStartDate: !!jsonObject.startDate,
                hasLocation: !!jsonObject.location
              })
            }).catch(async (error: any) => {
              logger.error('background', 'Failed to send event confirmation to content script', {
                tabId,
                eventData,
                errorName: error.name,
                errorMessage: error.message
              }, error)

              // Fallback: Open calendar directly
              logger.info('background', 'Falling back to direct calendar opening')
              await showNotification(
                'Event Extracted',
                `Opening Google Calendar with event: ${eventData.title}`
              )
              handleOpenCalendar(eventData)
            })
          } else {
            // Modal couldn't be shown, open calendar directly as fallback
            logger.info('background', 'Modal not available, opening calendar directly as fallback')
            await showNotification(
              'Event Extracted',
              `Modal unavailable. Opening Google Calendar directly with event: ${eventData.title}`
            )
            handleOpenCalendar(eventData)
          }
        } else if (event.type === 'error') {
          logger.error('background', 'Provider reported an error', { error: event.data.error })

          let errMsg = 'There was a problem communicating with the AI. Please try again later.'
          const error = event.data.error

          if (error instanceof Error) {
            // Provide more specific error messages based on error type
            const errorMessage = error.message.toLowerCase()
            if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
              errMsg = 'Invalid API key. Please check your API key in the extension settings.'
            } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
              errMsg = 'Rate limit exceeded. Please wait a moment and try again.'
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
              errMsg = 'Network error. Please check your internet connection and try again.'
            } else if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
              errMsg = 'API quota exceeded or billing issue. Please check your API account.'
            } else if (errorMessage.includes('model') || errorMessage.includes('not found')) {
              errMsg = 'The selected AI model is not available. Please try a different model in settings.'
            } else {
              errMsg = error.message
            }

            // Track specific error types
            ErrorTracker.trackError('background', error, {
              originalText: info,
              tabId,
              errorType: 'provider_error'
            })
          } else if (typeof error === 'string') {
            errMsg = error
          }

          processingError = new Error(errMsg)
        }
      }, // End onEvent
    }) // End generateAnswer call
  } catch (error: any) {
    // Catch errors from getProvider or synchronous parts before/after generateAnswer
    console.error(
      `[${new Date().toLocaleTimeString()}] Error during processing setup or unexpected failure:`,
      error,
    )
    processingError = error instanceof Error ? error : new Error('An unexpected error occurred.')
  } finally {
    // --- Centralized Cleanup Logic ---
    if (modalShown) {
      if (processingError) {
        // --- FAILURE PATH: Show Error in Modal ---
        logger.error('background', 'Processing finished with error', {
          error: processingError.message,
          tabId
        })
        const errorMessage = processingError.message || 'An unspecified error occurred.'
        try {
          logger.debug('background', `Sending showError message to tab ${tabId}`)
          await Browser.tabs.sendMessage(tabId, {
            action: 'showError',
            message: errorMessage,
          })
          logger.debug('background', 'showError message sent successfully')
        } catch (sendError: any) {
          logger.warn('background', `Could not send showError message to tab ${tabId}`, { tabId }, sendError)
        }
      }
      // Note: We don't hide the modal on success because the user needs to confirm the event
    } else {
      // Log if modal wasn't shown but an error still occurred
      if (processingError) {
        logger.error('background', 'Processing finished with error (modal message failed initially)', {
          error: processingError.message,
          tabId
        })
      } else {
        logger.info('background', 'Processing finished (modal message failed initially)', { tabId })
      }
    }
  } // End finally
} // End extractDate

// Make sure the required utility functions and listener setups are present
// (contextMenus.onClicked listener, openNewWindow, formatDateTimeForGoogle,
// calculateNextDay, extractAndParseJSONFromString, onStartup, onInstalled)
// Remember to define promptTemplate correctly!

// Function to ensure content script is injected
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    // First try to ping the existing content script
    await Browser.tabs.sendMessage(tabId, { action: 'ping' })
    logger.debug('background', 'Content script already available', { tabId })
    return true
  } catch (error) {
    // Content script not available, try to inject it
    logger.info('background', 'Content script not available, attempting injection', { tabId })

    try {
      // Get tab info to check if injection is allowed
      const tab = await Browser.tabs.get(tabId)
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        logger.warn('background', 'Cannot inject content script into restricted URL', { tabId, url: tab.url })
        return false
      }

      // Inject the content script
      await Browser.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content-script.js']
      })

      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500))

      // Test if injection worked
      await Browser.tabs.sendMessage(tabId, { action: 'ping' })
      logger.info('background', 'Content script injected successfully', { tabId })
      return true
    } catch (injectionError) {
      logger.error('background', 'Failed to inject content script', { tabId }, injectionError as Error)
      return false
    }
  }
}

// Add an event listener for when the menu item is clicked
Browser.contextMenus.onClicked.addListener(async (info, tab: Tabs.Tab) => {
  const sText = info.selectionText || ''

  if (!tab.id) {
    logger.error('background', 'No tab ID available for context menu click')
    await showNotification('Error', 'Cannot process request: No valid tab ID')
    return
  }

  // Ensure content script is available before processing
  const contentScriptAvailable = await ensureContentScriptInjected(tab.id)
  if (!contentScriptAvailable) {
    logger.error('background', 'Content script not available and injection failed', { tabId: tab.id })
    await showNotification(
      'Extension Error',
      'Cannot inject content script. Please refresh the page and try again.'
    )
    return
  }

  extractDate(sText, tab.id)
})

// Add message listener for calendar opening and debugging
Browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    logger.debug('background', 'Received message', { action: message.action, sender: sender.tab?.id })

    if (message.action === 'openCalendar') {
      await handleOpenCalendar(message.eventData)
    } else if (message.action === 'testContentScript') {
      // Debug function to test content script injection
      const tabs = await Browser.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        try {
          await Browser.tabs.sendMessage(tabs[0].id, { action: 'ping' })
          await showNotification('Debug', 'Content script is responding')
          sendResponse({ success: true, message: 'Content script is working' })
        } catch (error) {
          await showNotification('Debug', 'Content script is not responding')
          sendResponse({ success: false, message: 'Content script not responding', error: (error as Error).message })
        }
      }
    } else if (message.action === 'ping') {
      // Respond to ping from content script
      sendResponse({ success: true, message: 'Background script is working' })
    } else if (message.action === 'getCurrentProvider') {
      // Debug function to get current provider information
      try {
        const configs = await getProviderConfigs()
        const provider = await getProvider()
        const providerName = provider.constructor.name
        const isGemini = providerName === 'GeminiProvider'
        const isOpenAI = providerName === 'OpenAIProvider'

        // Get key information
        const keyInfo = await getKeyConfigInfo()

        const response = {
          success: true,
          selectedProvider: configs.provider,
          actualProvider: providerName,
          isUsingGemini: isGemini,
          isUsingOpenAI: isOpenAI,
          keyInfo: keyInfo,
          configs: {
            gemini: configs.configs[ProviderType.GEMINI],
            openai: configs.configs[ProviderType.GPT3]
          }
        }

        logger.info('background', 'Provider info requested', response)
        sendResponse(response)
      } catch (error) {
        logger.error('background', 'Error getting provider info', undefined, error as Error)
        sendResponse({ success: false, error: (error as Error).message })
      }
    }
  } catch (error) {
    logger.error('background', 'Error handling message', { message }, error as Error)
    sendResponse({ success: false, error: (error as Error).message })
  }

  return true // Keep message channel open for async response
})

async function handleOpenCalendar(eventData: any) {
  try {
    logger.info('background', 'Opening calendar with event data', { eventData })

    // Validate required fields
    if (!eventData.title || !eventData.title.trim()) {
      await showNotification('Error', 'Event title is required')
      return
    }

    if (!eventData.startDate) {
      await showNotification('Error', 'Start date is required')
      return
    }

    const formattedStartDate = formatDateTimeForGoogle(eventData.startDate, false) // Don't auto-adjust years from user input
    const formattedEndDate = eventData.endDate ? formatDateTimeForGoogle(eventData.endDate, false) : null

    let dateParamValue: string | null = null
    if (!formattedStartDate) {
      logger.error('background', 'Could not format start date for calendar', { startDate: eventData.startDate })
      await showNotification('Error', 'Invalid start date format')
      return
    }

    // Calculate dateParamValue using existing logic
    const startIsAllDay = formattedStartDate.length === 8
    if (formattedEndDate) {
      const endIsAllDay = formattedEndDate.length === 8
      if (startIsAllDay && endIsAllDay)
        dateParamValue = `${formattedStartDate}/${calculateNextDay(formattedEndDate)}`
      else if (!startIsAllDay && !endIsAllDay)
        dateParamValue = `${formattedStartDate}/${formattedEndDate}`
      else
        dateParamValue = startIsAllDay
          ? `${formattedStartDate}/${calculateNextDay(formattedStartDate)}`
          : `${formattedStartDate}/${formattedEndDate}`
    } else {
      dateParamValue = startIsAllDay
        ? `${formattedStartDate}/${calculateNextDay(formattedStartDate)}`
        : formattedStartDate
    }

    if (!dateParamValue) {
      console.error('Date parameter calculation failed.')
      return
    }

    const calendarUrl = new URL('https://www.google.com/calendar/event')
    calendarUrl.searchParams.set('action', 'TEMPLATE')
    calendarUrl.searchParams.set('text', eventData.title || 'Event from Text')
    calendarUrl.searchParams.set('dates', dateParamValue)

    if (eventData.location) calendarUrl.searchParams.set('location', eventData.location)

    let detailsText = eventData.description || ''
    if (eventData.originalText && eventData.originalText.trim() !== (eventData.description || '').trim()) {
      detailsText += (detailsText ? '\n\n---\n' : '') + `Original Text:\n${eventData.originalText}`
    }
    if (detailsText) calendarUrl.searchParams.set('details', detailsText)

    const finalUrl = calendarUrl.toString()
    console.log('Generated Calendar URL:', finalUrl)
    await openNewWindow(finalUrl)
  } catch (error) {
    console.error('Error opening calendar:', error)
  }
}

// function extractAndParseJSONFromString(inputString: string) {
//   const jsonRegex = /{[^}]*}/
//   const match = inputString.match(jsonRegex)

//   if (match) {
//     const jsonString = match[0]
//     try {
//       const jsonObject = JSON.parse(jsonString)
//       return jsonObject
//     } catch (error) {
//       console.error('Invalid JSON string:', error)
//       return null
//       }
//   } else {
//     console.error('No JSON content found in the input string.')
//     return null
//   }
// }

/**
 * Parses a date/time string (potentially from AI) and formats it
 * for Google Calendar URL parameters (YYYYMMDD or YYYYMMDDTHHmmssZ).
 * Also adjusts past years to the current year as a heuristic.
 *
 * @param {string | null} dateTimeString The date/time string to parse (e.g., "2020-03-30T12:15:00", "2024-07-15").
 * @param {boolean} [adjustPastYears=true] Whether to adjust years prior to the current year.
 * @returns {string | null} The formatted date string or null if parsing fails.
 */
function formatDateTimeForGoogle(dateTimeString, adjustPastYears = true) {
  if (!dateTimeString) {
    return null
  }

  try {
    // Attempt to parse the date string. Handles ISO 8601 variations.
    // IMPORTANT: new Date() parsing without 'Z' or offset assumes LOCAL time.
    const date = new Date(dateTimeString)

    // Check if parsing resulted in a valid date
    if (isNaN(date.getTime())) {
      console.warn(`Could not parse date string: ${dateTimeString}`)
      // Maybe try a fallback regex if needed for formats like YYYYMMDDTHHmmss
      // Example fallback (use cautiously):
      // const match = dateTimeString.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
      // if (match) {
      //    date = new Date(Date.UTC(match[1], match[2]-1, match[3], match[4], match[5], match[6]));
      //    if (isNaN(date.getTime())) { return null; } // Check again
      // } else {
      return null // Give up if invalid
      // }
    }

    const currentYear = new Date().getFullYear()
    const inputYear = date.getFullYear()

    // Only adjust year if it's significantly in the past (more than 1 year)
    // This prevents adjusting dates that are intentionally set to previous year
    if (adjustPastYears && inputYear < currentYear - 1) {
      logger.warn('background', `Adjusting old year (${inputYear}) to current year (${currentYear})`, {
        originalDate: dateTimeString,
        inputYear,
        currentYear
      })
      date.setFullYear(currentYear)
      // Re-check validity after potential year change
      if (isNaN(date.getTime())) {
        logger.error('background', 'Date became invalid after year adjustment')
        return null
      }
    }

    // Determine if it's an all-day event based on the *original* string format.
    // Check for YYYY-MM-DD format specifically.
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(dateTimeString)

    if (isAllDay) {
      // Format as YYYYMMDD
      const year = date.getFullYear().toString()
      const month = (date.getMonth() + 1).toString().padStart(2, '0') // Month is 0-indexed
      const day = date.getDate().toString().padStart(2, '0')
      return `${year}${month}${day}`
    } else {
      // Format as YYYYMMDDTHHmmssZ (UTC)
      // Use UTC methods to avoid timezone issues from the initial local parsing
      const year = date.getUTCFullYear().toString()
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
      const day = date.getUTCDate().toString().padStart(2, '0')
      const hours = date.getUTCHours().toString().padStart(2, '0')
      const minutes = date.getUTCMinutes().toString().padStart(2, '0')
      const seconds = date.getUTCSeconds().toString().padStart(2, '0')
      return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
    }
  } catch (error) {
    console.error(`Error formatting date string "${dateTimeString}":`, error)
    return null
  }
}

/**
 * Helper function to calculate the day after a given date in YYYYMMDD format.
 * Required for formatting all-day events for Google Calendar.
 * @param {string} yyyymmdd The date string in YYYYMMDD format.
 * @returns {string} The next day in YYYYMMDD format.
 */
function calculateNextDay(yyyymmdd) {
  try {
    const year = parseInt(yyyymmdd.substring(0, 4))
    const month = parseInt(yyyymmdd.substring(4, 6)) - 1 // JS months are 0-indexed
    const day = parseInt(yyyymmdd.substring(6, 8))
    const date = new Date(Date.UTC(year, month, day)) // Use UTC to avoid timezone shifts affecting the date
    date.setUTCDate(date.getUTCDate() + 1) // Add one day

    const nextYear = date.getUTCFullYear().toString()
    const nextMonth = (date.getUTCMonth() + 1).toString().padStart(2, '0')
    const nextDay = date.getUTCDate().toString().padStart(2, '0')
    return `${nextYear}${nextMonth}${nextDay}`
  } catch (e) {
    console.error('Error calculating next day:', e)
    return yyyymmdd // Fallback to original date
  }
}

/**
 * Extracts a JSON object string potentially embedded within a larger text,
 * attempts to fix common syntax issues (like single quotes), and parses it.
 *
 * @param {string} rawString The raw string possibly containing JSON.
 * @returns {object | null} The parsed JSON object or null if extraction/parsing fails.
 */
function extractAndParseJSONFromString(rawString) {
  if (!rawString || typeof rawString !== 'string') {
    console.error('Input to extractAndParseJSONFromString was not a valid string:', rawString)
    return null
  }

  try {
    // 1. Find the first '{' and the last '}'
    const startIndex = rawString.indexOf('{')
    const endIndex = rawString.lastIndexOf('}')

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      console.warn('Could not find JSON-like structure ({...}) in the string:', rawString)
      // Optional: Could try finding ```json ... ``` blocks too
      return null
    }

    // 2. Extract the potential JSON substring
    let jsonString = rawString.substring(startIndex, endIndex + 1)
    console.log('Extracted potential JSON substring:', jsonString)

    // 3. Attempt to fix common issues: Replace single quotes with double quotes
    // WARNING: This is a common heuristic for LLM outputs but can break
    // if the *actual string values* within the JSON contain single quotes (e.g., "it's").
    // More complex regex could be used, but this often works.
    // Also remove potential trailing commas before closing brace/bracket which are invalid JSON
    jsonString = jsonString.replace(/'/g, '"')
    jsonString = jsonString.replace(/,\s*([}\]])/g, '$1') // Remove trailing commas like ",}" or ",]"

    console.log('Attempted to fix quotes/commas:', jsonString)

    // 4. Parse the potentially fixed string
    const jsonObject = JSON.parse(jsonString)
    return jsonObject
  } catch (error) {
    console.error('Failed to parse JSON after extraction and fixing attempts:', error)
    console.error('Original raw string was:', rawString) // Log the original string that failed
    return null // Indicate failure
  }
}
