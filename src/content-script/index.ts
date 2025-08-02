// src/content-script/index.ts (Enhanced UX with Confirmation Modal)
import Browser from 'webextension-polyfill'
import { logger, setupGlobalErrorHandling } from '../logging'

// Setup global error handling for content script
setupGlobalErrorHandling('content-script')

logger.info('content-script', `Content script executing for: ${window.location.href}`)

// Add a global flag to track if content script is loaded
if (typeof window !== 'undefined') {
  (window as any).extensionContentScriptLoaded = true
  logger.info('content-script', 'Content script loaded flag set')
}

const CONFIRMATION_MODAL_ID = 'extension-confirmation-modal'
const MODAL_OVERLAY_ID = 'extension-modal-overlay'
const LOADING_INDICATOR_ID = 'extension-loading-indicator'

let currentEventData: any = null

function createConfirmationModal(): HTMLElement | null {
  try {
    logger.debug('content-script', 'Creating confirmation modal')

    // Check if document is ready
    if (!document.body) {
      logger.error('content-script', 'Document body not available for modal creation')
      return null
    }

    // Create modal overlay with enhanced styling to override any site CSS
    const overlay = document.createElement('div')
    overlay.id = MODAL_OVERLAY_ID
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: rgba(0, 0, 0, 0.7) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      transition: opacity 0.3s ease-in-out !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-sizing: border-box !important;
    `

    // Create modal container with enhanced styling
    const modal = document.createElement('div')
    modal.id = CONFIRMATION_MODAL_ID
    modal.style.cssText = `
      background-color: #ffffff !important;
      border-radius: 12px !important;
      padding: 24px !important;
      max-width: 500px !important;
      width: 90% !important;
      max-height: 80vh !important;
      overflow: auto !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      transform: scale(0.95) !important;
      transition: transform 0.3s ease-in-out !important;
      position: relative !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
      color: #000000 !important;
    `

    // Create loading indicator
    const loadingIndicator = document.createElement('div')
    loadingIndicator.id = LOADING_INDICATOR_ID
    loadingIndicator.style.display = 'flex'
    loadingIndicator.style.flexDirection = 'column'
    loadingIndicator.style.alignItems = 'center'
    loadingIndicator.style.padding = '20px'

    const spinner = document.createElement('div')
    spinner.style.border = '3px solid #f3f3f3'
    spinner.style.borderTop = '3px solid #3498db'
    spinner.style.borderRadius = '50%'
    spinner.style.width = '30px'
    spinner.style.height = '30px'
    spinner.style.animation = 'spin 1s linear infinite'
    spinner.style.marginBottom = '12px'

    const loadingText = document.createElement('div')
    loadingText.textContent = 'Extracting event details...'
    loadingText.style.color = '#666'
    loadingText.style.fontSize = '14px'

    loadingIndicator.appendChild(spinner)
    loadingIndicator.appendChild(loadingText)

    // Inject CSS for animations
    const existingStyle = document.head.querySelector(
      `style[data-ext-modal-id="${CONFIRMATION_MODAL_ID}"]`,
    )
    if (!existingStyle) {
      const style = document.createElement('style')
      style.setAttribute('data-ext-modal-id', CONFIRMATION_MODAL_ID)
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        #${MODAL_OVERLAY_ID}.visible {
          opacity: 1;
        }
        #${MODAL_OVERLAY_ID}.visible #${CONFIRMATION_MODAL_ID} {
          transform: scale(1);
        }
        .event-field {
          margin-bottom: 12px;
        }
        .event-field-label {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .event-field-value {
          color: #6b7280;
          font-size: 14px;
          background: #f9fafb;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .modal-button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }
        .modal-button-primary {
          background: #3b82f6;
          color: white;
        }
        .modal-button-primary:hover {
          background: #2563eb;
        }
        .modal-button-secondary {
          background: #f3f4f6;
          color: #374151;
          margin-right: 12px;
        }
        .modal-button-secondary:hover {
          background: #e5e7eb;
        }
        .error-message {
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }
      `
      document.head.appendChild(style)
    }

    modal.appendChild(loadingIndicator)
    overlay.appendChild(modal)

    logger.debug('content-script', 'Confirmation modal created successfully')
    return overlay
  } catch (e) {
    logger.error('content-script', 'Error creating confirmation modal', undefined, e as Error)
    return null
  }
}

function showConfirmationModal() {
  logger.debug('content-script', 'showConfirmationModal function entered')

  // Check if document is ready and body exists
  if (!document.body) {
    logger.error('content-script', 'Document body not available for modal display')
    return
  }

  let overlay = document.getElementById(MODAL_OVERLAY_ID)
  if (!overlay) {
    logger.debug('content-script', 'Creating new confirmation modal')
    overlay = createConfirmationModal()
    if (!overlay) {
      logger.error('content-script', 'Failed to create modal, aborting showConfirmationModal')
      return
    }

    try {
      // Check for potential CSP issues
      const testDiv = document.createElement('div')
      testDiv.style.cssText = 'position: fixed !important; z-index: 999999 !important;'
      document.body.appendChild(testDiv)
      document.body.removeChild(testDiv)

      // If test passed, append the actual modal
      document.body.appendChild(overlay)
      logger.debug('content-script', 'Successfully appended modal to body')

      // Force reflow to ensure styles are applied
      void overlay.offsetWidth
      void overlay.offsetHeight

    } catch (e) {
      logger.error('content-script', 'Error appending modal - possible CSP restriction', {
        error: (e as Error).message,
        url: window.location.href
      }, e as Error)
      return
    }
  }

  // Show modal with animation
  setTimeout(() => {
    if (overlay) {
      overlay.classList.add('visible')
      logger.debug('content-script', 'Modal visibility class added')
    }
  }, 10)

  // Prevent page scrolling
  try {
    document.body.style.overflow = 'hidden'
  } catch (e) {
    logger.warn('content-script', 'Could not set body overflow style', undefined, e as Error)
  }

  logger.info('content-script', 'Confirmation modal displayed successfully')
}

function showEventConfirmation(eventData: any) {
  logger.info('content-script', 'showEventConfirmation called', { eventData })
  currentEventData = eventData

  // First ensure the modal exists, create it if it doesn't
  let overlay = document.getElementById(MODAL_OVERLAY_ID)
  if (!overlay) {
    logger.warn('content-script', 'Modal overlay not found, creating it now')
    showConfirmationModal()
    overlay = document.getElementById(MODAL_OVERLAY_ID)
    if (!overlay) {
      logger.error('content-script', 'Failed to create modal overlay')
      return
    }
  }

  const modal = document.getElementById(CONFIRMATION_MODAL_ID)
  if (!modal) {
    logger.error('content-script', 'Modal not found for event confirmation even after creation attempt')
    return
  }

  // Hide loading indicator
  const loadingIndicator = document.getElementById(LOADING_INDICATOR_ID)
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none'
  }

  // Create confirmation content
  const confirmationContent = document.createElement('div')

  // Title
  const title = document.createElement('h2')
  title.textContent = 'Confirm Event Details'
  title.style.cssText = `
    margin: 0 0 20px 0 !important;
    fontSize: 20px !important;
    fontWeight: 600 !important;
    color: #111827 !important;
    fontFamily: inherit !important;
  `
  confirmationContent.appendChild(title)

  // Create editable form fields
  const formFields = createEditableEventForm(eventData)
  confirmationContent.appendChild(formFields)

  // Buttons
  const buttonContainer = document.createElement('div')
  buttonContainer.style.display = 'flex'
  buttonContainer.style.justifyContent = 'flex-end'
  buttonContainer.style.marginTop = '24px'

  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Cancel'
  cancelButton.className = 'modal-button modal-button-secondary'
  cancelButton.onclick = hideConfirmationModal

  const confirmButton = document.createElement('button')
  confirmButton.textContent = 'Add to Calendar'
  confirmButton.className = 'modal-button modal-button-primary'
  confirmButton.onclick = () => {
    // Collect data from form inputs
    const updatedEventData = collectFormData(formFields)

    // Validate required fields
    if (!updatedEventData.title.trim()) {
      alert('Please enter an event title')
      return
    }

    if (!updatedEventData.startDate) {
      alert('Please enter a start date and time')
      return
    }

    logger.info('content-script', 'User confirmed event with data', { updatedEventData })
    openGoogleCalendar(updatedEventData)
    hideConfirmationModal()
  }

  buttonContainer.appendChild(cancelButton)
  buttonContainer.appendChild(confirmButton)
  confirmationContent.appendChild(buttonContainer)

  // Replace modal content
  modal.innerHTML = ''
  modal.appendChild(confirmationContent)
}

function showErrorInModal(message: string) {
  console.log(`[Content Script] showErrorInModal called with message: "${message}"`)

  const modal = document.getElementById(CONFIRMATION_MODAL_ID)
  if (!modal) {
    console.error('[Content Script] Modal not found for error display.')
    return
  }

  // Hide loading indicator
  const loadingIndicator = document.getElementById(LOADING_INDICATOR_ID)
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none'
  }

  // Create error content
  const errorContent = document.createElement('div')

  const title = document.createElement('h2')
  title.textContent = 'Error Processing Event'
  title.style.margin = '0 0 20px 0'
  title.style.fontSize = '20px'
  title.style.fontWeight = '600'
  title.style.color = '#111827'
  errorContent.appendChild(title)

  const errorMessage = document.createElement('div')
  errorMessage.className = 'error-message'
  errorMessage.textContent = message || 'An unexpected error occurred.'
  errorContent.appendChild(errorMessage)

  const buttonContainer = document.createElement('div')
  buttonContainer.style.display = 'flex'
  buttonContainer.style.justifyContent = 'flex-end'
  buttonContainer.style.marginTop = '16px'

  const closeButton = document.createElement('button')
  closeButton.textContent = 'Close'
  closeButton.className = 'modal-button modal-button-secondary'
  closeButton.onclick = hideConfirmationModal

  buttonContainer.appendChild(closeButton)
  errorContent.appendChild(buttonContainer)

  // Replace modal content
  modal.innerHTML = ''
  modal.appendChild(errorContent)
}

function hideConfirmationModal() {
  const overlay = document.getElementById(MODAL_OVERLAY_ID)
  if (overlay) {
    console.log('[Content Script] Hiding confirmation modal.')
    overlay.classList.remove('visible')
    document.body.style.overflow = ''

    setTimeout(() => {
      const currentOverlay = document.getElementById(MODAL_OVERLAY_ID)
      if (currentOverlay && !currentOverlay.classList.contains('visible')) {
        currentOverlay.remove()
        console.log('[Content Script] Modal removed from DOM.')
      }
    }, 300)
  }

  currentEventData = null
}

// Utility functions
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''

    // Check if it's an all-day event (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return date.toISOString().split('T')[0] // Return YYYY-MM-DD format
    } else {
      // Return datetime-local format (YYYY-MM-DDTHH:MM)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
  } catch (e) {
    return ''
  }
}

function formatDateForInput(dateString: string | null, isDateTime: boolean = true): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''

    if (isDateTime) {
      // Return datetime-local format (YYYY-MM-DDTHH:MM)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } else {
      // Return date format (YYYY-MM-DD)
      return date.toISOString().split('T')[0]
    }
  } catch (e) {
    return ''
  }
}

function createEditableEventForm(eventData: any): HTMLElement {
  const form = document.createElement('div')
  form.style.cssText = `
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
  `

  // Helper function to create form field
  function createFormField(label: string, type: string, value: string, placeholder: string = '', required: boolean = false): HTMLElement {
    const fieldDiv = document.createElement('div')
    fieldDiv.style.cssText = `
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
    `

    const labelEl = document.createElement('label')
    labelEl.textContent = label + (required ? ' *' : '')
    labelEl.style.cssText = `
      font-weight: 600 !important;
      color: #374151 !important;
      font-size: 14px !important;
      font-family: inherit !important;
    `

    let inputEl: HTMLInputElement | HTMLTextAreaElement
    if (type === 'textarea') {
      inputEl = document.createElement('textarea')
      inputEl.rows = 3
    } else {
      inputEl = document.createElement('input')
      ;(inputEl as HTMLInputElement).type = type
    }

    inputEl.value = value
    inputEl.placeholder = placeholder
    if (required) inputEl.required = true

    inputEl.style.cssText = `
      padding: 8px 12px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      font-family: inherit !important;
      background: #ffffff !important;
      color: #000000 !important;
      box-sizing: border-box !important;
    `

    // Add focus styles
    inputEl.addEventListener('focus', () => {
      inputEl.style.borderColor = '#3b82f6'
      inputEl.style.outline = 'none'
      inputEl.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
    })

    inputEl.addEventListener('blur', () => {
      inputEl.style.borderColor = '#d1d5db'
      inputEl.style.boxShadow = 'none'
    })

    fieldDiv.appendChild(labelEl)
    fieldDiv.appendChild(inputEl)
    return fieldDiv
  }

  // Create form fields
  const titleField = createFormField('Event Title', 'text', eventData.title || '', 'Enter event title', true)
  const startDateField = createFormField('Start Date & Time', 'datetime-local', formatDateForInput(eventData.startDate), '', true)
  const endDateField = createFormField('End Date & Time', 'datetime-local', formatDateForInput(eventData.endDate), 'Optional')
  const locationField = createFormField('Location', 'text', eventData.location || '', 'Optional')
  const descriptionField = createFormField('Description', 'textarea', eventData.description || '', 'Optional')

  // Store references to inputs for later access
  ;(form as any).titleInput = titleField.querySelector('input')
  ;(form as any).startDateInput = startDateField.querySelector('input')
  ;(form as any).endDateInput = endDateField.querySelector('input')
  ;(form as any).locationInput = locationField.querySelector('input')
  ;(form as any).descriptionInput = descriptionField.querySelector('textarea')

  form.appendChild(titleField)
  form.appendChild(startDateField)
  form.appendChild(endDateField)
  form.appendChild(locationField)
  form.appendChild(descriptionField)

  return form
}

function collectFormData(formElement: any): any {
  return {
    title: formElement.titleInput?.value || '',
    startDate: formElement.startDateInput?.value || '',
    endDate: formElement.endDateInput?.value || '',
    location: formElement.locationInput?.value || '',
    description: formElement.descriptionInput?.value || '',
    originalText: currentEventData?.originalText || ''
  }
}

function openGoogleCalendar(eventData: any) {
  console.log('[Content Script] Opening Google Calendar with event data:', eventData)

  // Send message to background script to handle calendar URL generation
  Browser.runtime.sendMessage({
    action: 'openCalendar',
    eventData: eventData
  }).catch(error => {
    console.error('[Content Script] Error sending calendar message:', error)
  })
}

// --- Listener Setup ---
logger.info('content-script', 'Adding message listener')
Browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    logger.debug('content-script', 'Received message', { action: message.action })

    if (message.action === 'showModal') {
      showConfirmationModal()
    } else if (message.action === 'hideModal') {
      hideConfirmationModal()
    } else if (message.action === 'showEventConfirmation') {
      showEventConfirmation(message.eventData)
    } else if (message.action === 'showError') {
      showErrorInModal(message.message)
    } else if (message.action === 'ping') {
      // Respond to ping from background script
      logger.debug('content-script', 'Responding to ping')
      sendResponse({ success: true, message: 'Content script is working', url: window.location.href })
      return true
    } else {
      logger.warn('content-script', 'Unknown message action', { action: message.action })
    }
  } catch (error) {
    logger.error('content-script', 'Error handling message', { message }, error as Error)
  }
  // No return true needed
})
logger.info('content-script', 'Content script loaded and listener attached')

// --- pagehide Listener ---
window.addEventListener('pagehide', () => {
  logger.info('content-script', 'pagehide event detected, attempting to hide modal')
  hideConfirmationModal()
})

// --- Debug functions for testing (available in browser console) ---
if (typeof window !== 'undefined') {
  (window as any).extensionDebug = {
    testModal: () => {
      logger.info('content-script', 'Testing modal creation')
      showConfirmationModal()
    },
    testEventConfirmation: () => {
      const testEventData = {
        title: 'Test Event',
        startDate: '2025-08-02T15:00:00',
        endDate: '2025-08-02T16:00:00',
        location: 'Test Location',
        description: 'Test Description',
        originalText: 'Test meeting tomorrow at 3 PM'
      }
      logger.info('content-script', 'Testing event confirmation with test data')
      showEventConfirmation(testEventData)
    },
    hideModal: () => {
      logger.info('content-script', 'Hiding modal via debug function')
      hideConfirmationModal()
    },
    checkModalExists: () => {
      const overlay = document.getElementById(MODAL_OVERLAY_ID)
      const modal = document.getElementById(CONFIRMATION_MODAL_ID)
      const result = {
        overlayExists: !!overlay,
        modalExists: !!modal,
        overlayVisible: overlay?.classList.contains('visible'),
        overlayDisplay: overlay?.style.display,
        overlayZIndex: overlay?.style.zIndex,
        bodyOverflow: document.body.style.overflow
      }
      logger.info('content-script', 'Modal existence check', result)
      console.log('Modal debug info:', result)
      return result
    },
    testBackgroundConnection: async () => {
      try {
        const response = await Browser.runtime.sendMessage({ action: 'ping' })
        console.log('Background script response:', response)
        return response
      } catch (error) {
        console.error('Failed to connect to background script:', error)
        return { success: false, error: (error as Error).message }
      }
    },
    checkCurrentProvider: async () => {
      try {
        logger.info('content-script', 'Requesting current AI provider information')
        const response = await Browser.runtime.sendMessage({ action: 'getCurrentProvider' })
        console.log('🤖 Current AI Provider Configuration:', response)
        logger.info('content-script', 'Provider info received', response)
        return response
      } catch (error) {
        console.error('❌ Failed to get provider info:', error)
        logger.error('content-script', 'Failed to get provider info', undefined, error as Error)
        return { success: false, error: (error as Error).message }
      }
    },
    getContentScriptInfo: () => {
      const info = {
        url: window.location.href,
        contentScriptLoaded: !!(window as any).extensionContentScriptLoaded,
        debugFunctionsAvailable: typeof (window as any).extensionDebug !== 'undefined',
        browserExtensionAvailable: typeof Browser !== 'undefined',
        documentReady: document.readyState,
        bodyAvailable: !!document.body,
        canCreateElements: false,
        canAppendToBody: false,
        cspRestrictions: false
      }

      // Test DOM manipulation capabilities
      try {
        const testDiv = document.createElement('div')
        info.canCreateElements = true

        if (document.body) {
          document.body.appendChild(testDiv)
          info.canAppendToBody = true
          document.body.removeChild(testDiv)
        }
      } catch (error) {
        info.cspRestrictions = true
        console.warn('DOM manipulation test failed:', error)
      }

      console.log('Content script info:', info)
      return info
    },
    testDOMManipulation: () => {
      try {
        // Create a test element with high z-index
        const testElement = document.createElement('div')
        testElement.style.cssText = `
          position: fixed !important;
          top: 10px !important;
          right: 10px !important;
          width: 200px !important;
          height: 50px !important;
          background: #4CAF50 !important;
          color: white !important;
          z-index: 2147483647 !important;
          padding: 10px !important;
          border-radius: 5px !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
        `
        testElement.textContent = 'Extension DOM Test - Click to Remove'
        testElement.onclick = () => testElement.remove()

        document.body.appendChild(testElement)

        setTimeout(() => {
          if (testElement.parentNode) {
            testElement.remove()
          }
        }, 5000)

        console.log('DOM manipulation test successful')
        return { success: true, message: 'Test element created and will auto-remove in 5 seconds' }
      } catch (error) {
        console.error('DOM manipulation test failed:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  }
}
