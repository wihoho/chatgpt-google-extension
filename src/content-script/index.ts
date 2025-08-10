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
const ERROR_MODAL_ID = 'extension-error-modal'

// Review prompt constants
const REVIEW_PROMPT_INTERVAL = 2
const CHROME_WEB_STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/chatgpt-for-google-calend/laejdmahdkleahgkdpiapfdcmleedhca?hl=en'

let currentEventData: any = null

// Event tracking and review prompt functions
async function incrementSuccessfulEvents(): Promise<number> {
  try {
    const result = await Browser.storage.local.get(['successfulEvents'])
    const count = (result.successfulEvents || 0) + 1
    await Browser.storage.local.set({ successfulEvents: count })
    logger.info('content-script', 'Incremented successful events count', { count })
    return count
  } catch (error) {
    logger.error('content-script', 'Failed to increment successful events', undefined, error as Error)
    return 0
  }
}

async function shouldShowReviewPrompt(): Promise<boolean> {
  try {
    const result = await Browser.storage.local.get(['successfulEvents', 'reviewPromptDismissed'])
    const count = result.successfulEvents || 0
    const dismissed = result.reviewPromptDismissed || false

    // Show prompt if user has created exactly a multiple of 5 events and hasn't permanently dismissed
    const shouldShow = !dismissed && count > 0 && count % REVIEW_PROMPT_INTERVAL === 0
    logger.debug('content-script', 'Review prompt check', { count, dismissed, shouldShow })
    return shouldShow
  } catch (error) {
    logger.error('content-script', 'Failed to check review prompt status', undefined, error as Error)
    return false
  }
}

async function markReviewPromptDismissed(): Promise<void> {
  try {
    await Browser.storage.local.set({ reviewPromptDismissed: true })
    logger.info('content-script', 'Review prompt permanently dismissed')
  } catch (error) {
    logger.error('content-script', 'Failed to mark review prompt as dismissed', undefined, error as Error)
  }
}

function createReviewPrompt(): HTMLElement {
  const reviewPrompt = document.createElement('div')
  reviewPrompt.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 16px !important;
    margin: 16px 0 !important;
    color: white !important;
    font-family: inherit !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
  `

  reviewPrompt.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 20px; margin-right: 8px;">⭐</span>
      <span style="font-weight: 600; font-size: 16px;">Enjoying the extension?</span>
    </div>
    <div style="margin-bottom: 16px; font-size: 14px; line-height: 1.4; opacity: 0.95;">
      Help others discover this extension by leaving a review on the Chrome Web Store!
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="review-now-btn" style="
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
      ">⭐ Review Now</button>
      <button id="maybe-later-btn" style="
        background: transparent !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: rgba(255, 255, 255, 0.8) !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
      ">Maybe Later</button>
    </div>
  `

  // Add hover effects
  const reviewNowBtn = reviewPrompt.querySelector('#review-now-btn') as HTMLElement
  const maybeLaterBtn = reviewPrompt.querySelector('#maybe-later-btn') as HTMLElement

  if (reviewNowBtn) {
    reviewNowBtn.addEventListener('mouseenter', () => {
      reviewNowBtn.style.background = 'rgba(255, 255, 255, 0.3) !important'
      reviewNowBtn.style.transform = 'translateY(-1px)'
    })
    reviewNowBtn.addEventListener('mouseleave', () => {
      reviewNowBtn.style.background = 'rgba(255, 255, 255, 0.2) !important'
      reviewNowBtn.style.transform = 'translateY(0)'
    })
    reviewNowBtn.addEventListener('click', async () => {
      logger.info('content-script', 'User clicked Review Now')
      await markReviewPromptDismissed()
      window.open(CHROME_WEB_STORE_REVIEW_URL, '_blank')
    })
  }

  if (maybeLaterBtn) {
    maybeLaterBtn.addEventListener('mouseenter', () => {
      maybeLaterBtn.style.background = 'rgba(255, 255, 255, 0.1) !important'
      maybeLaterBtn.style.color = 'white !important'
    })
    maybeLaterBtn.addEventListener('mouseleave', () => {
      maybeLaterBtn.style.background = 'transparent !important'
      maybeLaterBtn.style.color = 'rgba(255, 255, 255, 0.8) !important'
    })
    maybeLaterBtn.addEventListener('click', () => {
      logger.info('content-script', 'User clicked Maybe Later')
    })
  }

  return reviewPrompt
}

// Error dialog for failed AI detection
function createErrorModal(errorType?: string): HTMLElement | null {
  try {
    logger.debug('content-script', 'Creating error modal for failed AI detection', { errorType })

    // Check if document is ready
    if (!document.body) {
      logger.error('content-script', 'Document body not available for error modal creation')
      return null
    }

    // Create modal overlay with error styling
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

    // Create error modal container with distinct error styling
    const modal = document.createElement('div')
    modal.id = ERROR_MODAL_ID
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
      border-left: 4px solid #ef4444 !important;
    `

    // Error content
    const errorContent = document.createElement('div')

    // Error icon and title
    const titleContainer = document.createElement('div')
    titleContainer.style.cssText = `
      display: flex !important;
      align-items: center !important;
      margin-bottom: 16px !important;
    `

    const errorIcon = document.createElement('span')
    errorIcon.textContent = '⚠️'
    errorIcon.style.cssText = `
      font-size: 24px !important;
      margin-right: 12px !important;
    `

    const title = document.createElement('h2')

    // Customize title and message based on error type
    if (errorType === 'timeout') {
      errorIcon.textContent = '⏱️'
      title.textContent = 'Extraction Timed Out'
    } else {
      errorIcon.textContent = '⚠️'
      title.textContent = 'No Event Information Found'
    }

    title.style.cssText = `
      margin: 0 !important;
      font-size: 20px !important;
      font-weight: 600 !important;
      color: #dc2626 !important;
      font-family: inherit !important;
    `

    titleContainer.appendChild(errorIcon)
    titleContainer.appendChild(title)
    errorContent.appendChild(titleContainer)

    // Error message
    const message = document.createElement('div')
    message.style.cssText = `
      margin-bottom: 20px !important;
      line-height: 1.5 !important;
      color: #374151 !important;
      font-size: 14px !important;
    `

    if (errorType === 'timeout') {
      message.innerHTML = `
        <p style="margin: 0 0 12px 0;">The AI service took too long to respond (more than 5 seconds).</p>
        <p style="margin: 0 0 16px 0;"><strong>This usually happens when:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>The selected text is very long or complex</li>
          <li>The AI service is experiencing high load</li>
          <li>Network connectivity is slow</li>
        </ul>
        <p style="margin: 0 0 16px 0;"><strong>To improve success, try selecting shorter, more specific text that includes:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>Clear dates and times (e.g., "March 15 at 3 PM")</li>
          <li>Concise event descriptions</li>
          <li>Essential details only</li>
        </ul>
        <p style="margin: 0; font-style: italic; color: #6b7280;">Example: "Team meeting tomorrow at 2 PM in Conference Room A"</p>
      `
    } else {
      message.innerHTML = `
        <p style="margin: 0 0 12px 0;">We couldn't extract any event information from the selected text.</p>
        <p style="margin: 0 0 16px 0;"><strong>To get better results, try selecting text that includes:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>Specific dates (e.g., "March 15" or "next Tuesday")</li>
          <li>Times (e.g., "3:00 PM" or "at 2pm")</li>
          <li>Event descriptions (e.g., "meeting", "appointment", "call")</li>
          <li>Location information when available</li>
        </ul>
        <p style="margin: 0; font-style: italic; color: #6b7280;">Example: "Team meeting tomorrow at 2 PM in Conference Room A"</p>
      `
    }
    errorContent.appendChild(message)

    // Buttons
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex !important;
      justify-content: flex-end !important;
      gap: 12px !important;
      margin-top: 24px !important;
    `

    const cancelButton = document.createElement('button')
    cancelButton.textContent = 'Cancel'
    cancelButton.style.cssText = `
      background: #f3f4f6 !important;
      color: #374151 !important;
      border: 1px solid #d1d5db !important;
      padding: 10px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    `
    cancelButton.onclick = hideErrorModal

    const retryButton = document.createElement('button')
    retryButton.textContent = 'Try Again'
    retryButton.style.cssText = `
      background: #3b82f6 !important;
      color: white !important;
      border: 1px solid #3b82f6 !important;
      padding: 10px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    `
    retryButton.onclick = hideErrorModal

    // Add hover effects
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.background = '#e5e7eb !important'
    })
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.background = '#f3f4f6 !important'
    })

    retryButton.addEventListener('mouseenter', () => {
      retryButton.style.background = '#2563eb !important'
    })
    retryButton.addEventListener('mouseleave', () => {
      retryButton.style.background = '#3b82f6 !important'
    })

    buttonContainer.appendChild(cancelButton)
    buttonContainer.appendChild(retryButton)
    errorContent.appendChild(buttonContainer)

    modal.appendChild(errorContent)
    overlay.appendChild(modal)

    // Add CSS for visibility toggle
    overlay.classList.add('visible')
    const style = document.createElement('style')
    style.textContent = `
      .visible { opacity: 1 !important; }
      .visible > div { transform: scale(1) !important; }
    `
    document.head.appendChild(style)

    return overlay
  } catch (error) {
    logger.error('content-script', 'Error creating error modal', undefined, error as Error)
    return null
  }
}

function hideErrorModal() {
  logger.debug('content-script', 'Hiding error modal')
  const overlay = document.getElementById(MODAL_OVERLAY_ID)
  if (overlay) {
    overlay.classList.remove('visible')
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    }, 300)
  }

  // Restore page scrolling
  try {
    document.body.style.overflow = ''
  } catch (e) {
    logger.warn('content-script', 'Could not restore body overflow style', undefined, e as Error)
  }

  logger.info('content-script', 'Error modal hidden')
}

function showErrorModal(errorType?: string) {
  logger.debug('content-script', 'showErrorModal function entered', { errorType })

  // Check if document is ready and body exists
  if (!document.body) {
    logger.error('content-script', 'Document body not available for error modal display')
    return
  }

  // Remove any existing modal overlay first and reset body styles
  const existingOverlay = document.getElementById(MODAL_OVERLAY_ID)
  if (existingOverlay) {
    logger.debug('content-script', 'Removing existing modal overlay', {
      existingOverlayId: existingOverlay.id,
      existingOverlayClass: existingOverlay.className
    })
    existingOverlay.remove()

    // Reset body overflow in case it was set by previous modal
    try {
      document.body.style.overflow = ''
    } catch (e) {
      logger.warn('content-script', 'Could not reset body overflow style', undefined, e as Error)
    }
  }

  // Create new error modal
  logger.debug('content-script', 'Creating new error modal')
  const overlay = createErrorModal(errorType)
  if (!overlay) {
    logger.error('content-script', 'Failed to create error modal, aborting showErrorModal')
    return
  }

  try {
    document.body.appendChild(overlay)
    logger.debug('content-script', 'Successfully appended error modal to body')

    // Force reflow to ensure styles are applied
    void overlay.offsetWidth
    void overlay.offsetHeight

  } catch (e) {
    logger.error('content-script', 'Error appending error modal', {
      error: (e as Error).message,
      url: window.location.href
    }, e as Error)
    return
  }

  // Show modal with animation
  setTimeout(() => {
    if (overlay) {
      overlay.classList.add('visible')
      logger.debug('content-script', 'Error modal visibility class added', {
        overlayId: overlay.id,
        overlayDisplay: getComputedStyle(overlay).display,
        overlayOpacity: getComputedStyle(overlay).opacity,
        overlayZIndex: getComputedStyle(overlay).zIndex
      })
    }
  }, 10)

  // Prevent page scrolling
  try {
    document.body.style.overflow = 'hidden'
  } catch (e) {
    logger.warn('content-script', 'Could not set body overflow style', undefined, e as Error)
  }

  // Additional debugging
  logger.info('content-script', 'Error modal displayed successfully', {
    overlayInDOM: !!document.getElementById(MODAL_OVERLAY_ID),
    bodyChildrenCount: document.body.children.length,
    errorType: errorType
  })
}

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
      pointer-events: auto !important;
      visibility: visible !important;
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

  // Remove any existing modal first
  const existingOverlay = document.getElementById(MODAL_OVERLAY_ID)
  if (existingOverlay) {
    logger.debug('content-script', 'Removing existing modal overlay')
    existingOverlay.remove()
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

      // Additional debugging
      logger.info('content-script', 'Modal creation debug info', {
        overlayId: overlay.id,
        overlayInDOM: !!document.getElementById(MODAL_OVERLAY_ID),
        overlayParent: overlay.parentElement?.tagName,
        overlayDisplay: getComputedStyle(overlay).display,
        overlayVisibility: getComputedStyle(overlay).visibility,
        overlayZIndex: getComputedStyle(overlay).zIndex,
        bodyChildrenCount: document.body.children.length
      })

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
      overlay.style.opacity = '1'
      logger.debug('content-script', 'Modal visibility class added and opacity set')

      // Additional debugging after making visible
      logger.info('content-script', 'Modal visibility debug info', {
        hasVisibleClass: overlay.classList.contains('visible'),
        computedOpacity: getComputedStyle(overlay).opacity,
        computedDisplay: getComputedStyle(overlay).display,
        boundingRect: overlay.getBoundingClientRect()
      })
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

function createFallbackModal() {
  logger.info('content-script', 'Creating fallback modal')

  // Create a very simple modal that should work on any page
  const overlay = document.createElement('div')
  overlay.id = MODAL_OVERLAY_ID
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 400px;
      font-family: Arial, sans-serif;
    ">
      <h3 style="margin: 0 0 15px 0; color: #333;">Processing Event...</h3>
      <p style="margin: 0 0 15px 0; color: #666;">
        The extension is processing your selected text to extract event information.
      </p>
      <div style="text-align: center;">
        <div style="
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `

  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(0, 0, 0, 0.5) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  `

  document.body.appendChild(overlay)
  logger.info('content-script', 'Fallback modal created and displayed')
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

  // Check if we should show review prompt
  shouldShowReviewPrompt().then(shouldShow => {
    if (shouldShow) {
      const reviewPrompt = createReviewPrompt()
      confirmationContent.insertBefore(reviewPrompt, confirmationContent.lastElementChild || null)
    }
  }).catch(error => {
    logger.error('content-script', 'Error checking review prompt status', undefined, error)
  })

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
  confirmButton.onclick = async () => {
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

    // Increment successful events counter
    await incrementSuccessfulEvents()

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

      // Verify modal was created and add fallback
      setTimeout(() => {
        const overlay = document.getElementById(MODAL_OVERLAY_ID)
        if (!overlay) {
          logger.warn('content-script', 'Modal not found after creation, creating fallback')
          try {
            createFallbackModal()
          } catch (error) {
            logger.error('content-script', 'Fallback modal creation failed, using alert', undefined, error as Error)
            alert('ChatGPT Calendar Extension: Processing your selected text...')
          }
        }
      }, 100)
    } else if (message.action === 'hideModal') {
      hideConfirmationModal()
    } else if (message.action === 'showEventConfirmation') {
      showEventConfirmation(message.eventData)
    } else if (message.action === 'showExtractionError') {
      logger.info('content-script', 'Showing extraction error modal', {
        originalText: message.originalText,
        errorType: message.errorType
      })

      // Add debugging to check current modal state
      const existingModal = document.getElementById(MODAL_OVERLAY_ID)
      logger.debug('content-script', 'Modal state before error modal', {
        existingModalExists: !!existingModal,
        existingModalId: existingModal?.id,
        existingModalVisible: existingModal ? getComputedStyle(existingModal).display : 'none'
      })

      // Directly show error modal (it will handle replacing any existing modal)
      showErrorModal(message.errorType)
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
