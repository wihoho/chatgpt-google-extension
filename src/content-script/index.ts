// src/content.ts (Modified for Error Display)
import Browser from 'webextension-polyfill'

console.log(
  `[${new Date().toLocaleTimeString()}] Content script executing for: ${window.location.href}`,
)

const SPINNER_OVERLAY_ID = 'extension-fullpage-spinner-overlay'
const SPINNER_GRAPHIC_ID = 'extension-spinner-graphic' // ID for the spinning element
const SPINNER_MESSAGE_ID = 'extension-spinner-message' // ID for the text area (error or status)

let errorDisplayTimeoutId: number | null = null // Store timeout ID

function createSpinnerElement(): HTMLElement | null {
  try {
    const overlay = document.createElement('div')
    overlay.id = SPINNER_OVERLAY_ID
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'
    overlay.style.zIndex = '2147483647'
    overlay.style.display = 'flex'
    // --- Change layout to column for spinner + text ---
    overlay.style.flexDirection = 'column'
    overlay.style.justifyContent = 'center'
    overlay.style.alignItems = 'center'
    overlay.style.cursor = 'progress'
    // overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-in-out, visibility 0s linear 0.3s'
    overlay.style.textAlign = 'center' // Center text below spinner

    // --- Spinner Graphic ---
    const spinner = document.createElement('div')
    spinner.id = SPINNER_GRAPHIC_ID // Assign ID
    spinner.style.border = '8px solid #f3f3f3'
    spinner.style.borderTop = '8px solid #3498db'
    spinner.style.borderRadius = '50%'
    spinner.style.width = '60px'
    spinner.style.height = '60px'
    spinner.style.animation = 'spin 1s linear infinite'
    spinner.style.marginBottom = '15px' // Space between spinner and text

    // --- Message Area (initially empty) ---
    const messageArea = document.createElement('div')
    messageArea.id = SPINNER_MESSAGE_ID // Assign ID
    messageArea.style.color = '#ffffff' // Default text color (white)
    messageArea.style.fontSize = '16px'
    messageArea.style.maxWidth = '80%'

    // --- Inject CSS ---
    const existingStyle = document.head.querySelector(
      `style[data-ext-spinner-id="${SPINNER_OVERLAY_ID}"]`,
    )
    if (!existingStyle) {
      const style = document.createElement('style')
      style.setAttribute('data-ext-spinner-id', SPINNER_OVERLAY_ID)
      style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                #${SPINNER_OVERLAY_ID}.visible {
                    opacity: 1;
                    visibility: visible;
                    transition-delay: 0s, 0s;
                }
                 /* Style for error message text */
                #${SPINNER_MESSAGE_ID}.error-message {
                    color: #ffdddd; /* Light red for errors */
                    font-weight: bold;
                }
                 /* Style to hide spinner graphic when error shows */
                #${SPINNER_OVERLAY_ID}.error-state #${SPINNER_GRAPHIC_ID} {
                    display: none;
                }
            `
      document.head.appendChild(style)
      console.log('[Content Script] Injected spinner CSS.')
    }

    overlay.appendChild(spinner) // Add spinner
    overlay.appendChild(messageArea) // Add message area
    console.log('[Content Script] createSpinnerElement: Created overlay element:', overlay)
    return overlay
  } catch (e) {
    console.error('[Content Script] Error within createSpinnerElement:', e)
    return null
  }
}

function showSpinner() {
  console.log('[Content Script] showSpinner function ENTERED')
  // Clear any pending error timeout if we're showing the spinner again
  if (errorDisplayTimeoutId) {
    clearTimeout(errorDisplayTimeoutId)
    errorDisplayTimeoutId = null
    console.log('[Content Script] Cleared pending error display timeout.')
  }

  let overlay = document.getElementById(SPINNER_OVERLAY_ID)
  if (!overlay) {
    console.log('[Content Script] Existing overlay NOT found. Calling createSpinnerElement...')
    overlay = createSpinnerElement()
    if (!overlay) {
      console.error('[Content Script] FAILED TO CREATE OVERLAY ELEMENT. Aborting showSpinner.')
      return
    }
    // Append logic...
    try {
      if (document.body) {
        document.body.appendChild(overlay)
        console.log('[Content Script] Successfully appended overlay to body.')
        void overlay.offsetWidth
      } else {
        /* error handling */ return
      }
    } catch (e) {
      /* error handling */ return
    }
  } else {
    // --- Reset existing overlay state if reusing ---
    console.log('[Content Script] Found existing overlay element. Resetting state.')
    overlay.classList.remove('error-state') // Remove error class if present
    const msgArea = overlay.querySelector(`#${SPINNER_MESSAGE_ID}`) as HTMLElement
    if (msgArea) {
      msgArea.textContent = '' // Clear old message
      msgArea.classList.remove('error-message')
    }
    const spinnerGraphic = overlay.querySelector(`#${SPINNER_GRAPHIC_ID}`) as HTMLElement
    if (spinnerGraphic) {
      spinnerGraphic.style.display = '' // Ensure spinner graphic is visible
    }
  }

  console.log(
    `[${new Date().toLocaleTimeString()}] Content script: Adding .visible class to spinner.`,
  )
  overlay.classList.add('visible')
  document.body.style.overflow = 'hidden'
}

// --- NEW FUNCTION ---
function showErrorOnSpinner(message: string) {
  console.log(`[Content Script] showErrorOnSpinner called with message: "${message}"`)
  const overlay = document.getElementById(SPINNER_OVERLAY_ID)
  if (!overlay) {
    console.warn('[Content Script] Cannot show error message, overlay not found.')
    // Optionally, try creating it? Or just log. For now, just log.
    // showSpinner(); // This would show spinner THEN error, might be weird
    // overlay = document.getElementById(SPINNER_OVERLAY_ID);
    // if (!overlay) return; // Give up if still not found
    return
  }

  // Clear any previous error timeout
  if (errorDisplayTimeoutId) {
    clearTimeout(errorDisplayTimeoutId)
    errorDisplayTimeoutId = null
  }

  // Ensure overlay is visible if it wasn't already (e.g., error happened very fast)
  overlay.classList.add('visible')
  overlay.classList.add('error-state') // Add class to hide spinner via CSS

  const messageArea = overlay.querySelector(`#${SPINNER_MESSAGE_ID}`) as HTMLElement
  if (messageArea) {
    messageArea.textContent = message || 'An error occurred.' // Display the message
    messageArea.classList.add('error-message') // Add error styling class
  } else {
    console.error('[Content Script] Message area element not found within overlay.')
  }

  // Set timeout to hide the spinner after 4 seconds
  console.log('[Content Script] Setting timeout to hide spinner after error display (4s).')
  errorDisplayTimeoutId = window.setTimeout(() => {
    console.log('[Content Script] Error display timeout finished. Calling hideSpinner.')
    hideSpinner()
    errorDisplayTimeoutId = null // Clear the stored ID
  }, 3000) // 4 seconds
}

function hideSpinner() {
  // Clear error timeout if hide is called externally (e.g., pagehide)
  if (errorDisplayTimeoutId) {
    clearTimeout(errorDisplayTimeoutId)
    errorDisplayTimeoutId = null
    console.log(
      '[Content Script] Cleared pending error display timeout because hideSpinner was called.',
    )
  }

  const overlay = document.getElementById(SPINNER_OVERLAY_ID)
  if (overlay) {
    console.log(
      `[${new Date().toLocaleTimeString()}] Content script: Hiding spinner (removing .visible class).`,
    )
    overlay.classList.remove('visible')
    document.body.style.overflow = ''

    setTimeout(() => {
      const currentOverlay = document.getElementById(SPINNER_OVERLAY_ID)
      if (currentOverlay && !currentOverlay.classList.contains('visible')) {
        currentOverlay.remove()
        console.log(
          `[${new Date().toLocaleTimeString()}] Content script: Spinner element removed from DOM.`,
        )
      }
    }, 300 + 50)
  } else {
    console.log(
      `[${new Daste().toLocaleTimeString()}] Content script: Hide called, but spinner overlay not found.`,
    )
  }
}

// --- Listener Setup ---
console.log(`[${new Date().toLocaleTimeString()}] Content script: Adding message listener...`)
Browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`[${new Date().toLocaleTimeString()}] Content script received message:`, message)
  if (message.action === 'showSpinner') {
    showSpinner()
  } else if (message.action === 'hideSpinner') {
    hideSpinner()
    // --- ADDED ERROR HANDLER ---
  } else if (message.action === 'showError') {
    showErrorOnSpinner(message.message) // Pass the message text
  }
  // No return true needed
})
console.log(`[${new Date().toLocaleTimeString()}] Content script loaded and listener attached.`)

// --- pagehide Listener ---
window.addEventListener('pagehide', () => {
  console.log(
    `[${new Date().toLocaleTimeString()}] Content script: pagehide event detected, attempting to hide spinner.`,
  )
  hideSpinner() // This will also clear any pending error timeout
})
