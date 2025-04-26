// src/content.ts (or wherever you place it)
import Browser from 'webextension-polyfill'

const SPINNER_OVERLAY_ID = 'extension-fullpage-spinner-overlay'

function createSpinnerElement(): HTMLElement {
  const overlay = document.createElement('div')
  overlay.id = SPINNER_OVERLAY_ID
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100vw' // Cover full viewport width
  overlay.style.height = '100vh' // Cover full viewport height
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)' // Semi-transparent black
  overlay.style.zIndex = '2147483647' // Max z-index
  overlay.style.display = 'flex'
  overlay.style.justifyContent = 'center'
  overlay.style.alignItems = 'center'
  overlay.style.cursor = 'progress' // Indicate loading state
  // overlay.style.visibility = 'hidden'; // Initially hidden

  // --- Simple CSS Spinner ---
  const spinner = document.createElement('div')
  spinner.style.border = '8px solid #f3f3f3' // Light grey border
  spinner.style.borderTop = '8px solid #3498db' // Blue top border
  spinner.style.borderRadius = '50%'
  spinner.style.width = '60px'
  spinner.style.height = '60px'
  spinner.style.animation = 'spin 1s linear infinite'

  // --- Keyframes for animation (injected via <style>) ---
  const style = document.createElement('style')
  style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #${SPINNER_OVERLAY_ID} { /* Style for the overlay itself */
             transition: visibility 0s linear 0s, opacity 0.3s ease-in-out;
             opacity: 0;
        }
         #${SPINNER_OVERLAY_ID}.visible { /* Style when visible */
             visibility: visible;
             opacity: 1;
        }

    `
  document.head.appendChild(style) // Add styles to head
  overlay.appendChild(spinner)
  console.log('[Content Script] createSpinnerElement: Created overlay element:', overlay)
  return overlay
}

function showSpinner() {
  let overlay = document.getElementById(SPINNER_OVERLAY_ID)
  if (!overlay) {
    overlay = createSpinnerElement()
    document.body.appendChild(overlay) // Append to body
    // Force reflow to ensure transition applies correctly on first show
    void overlay.offsetWidth
  }
  console.log('Showing spinner overlay')
  overlay.classList.add('visible') // Use class for visibility/opacity transition
  // Optional: Disable scrolling on the body while spinner is active
  document.body.style.overflow = 'hidden'
}

function hideSpinner() {
  const overlay = document.getElementById(SPINNER_OVERLAY_ID)
  if (overlay) {
    console.log('Hiding spinner overlay')
    overlay.classList.remove('visible')
    // Optional: Re-enable scrolling
    document.body.style.overflow = '' // Reset to default

    // Remove the element after transition/delay to prevent user interaction
    // Adjust timeout to match CSS transition duration
    setTimeout(() => {
      if (!overlay.classList.contains('visible')) {
        // Check if it wasn't shown again quickly
        overlay.remove()
      }
    }, 300) // Matches the opacity transition duration
  }
}

// Listen for messages from the background script
Browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message)
  if (message.action === 'showSpinner') {
    showSpinner()
    // Optional: Send confirmation back if needed
    // sendResponse({ success: true });
  } else if (message.action === 'hideSpinner') {
    hideSpinner()
    // Optional: Send confirmation back if needed
    // sendResponse({ success: true });
  }
  // Return false or undefined if not handling the message or not sending async response
})

console.log('Content script loaded and listening for spinner messages.')

// Optional: Hide spinner if the page is navigated away from while spinner is active
// This handles cases like clicking back/forward before processing finishes
window.addEventListener('pagehide', () => {
  hideSpinner()
})
