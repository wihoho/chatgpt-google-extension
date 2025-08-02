# ChatGPT for Google Calendar - Debugging Guide

## Modal Display Issues

### Problem Description
The confirmation modal is not appearing despite successful AI processing, and the webpage becomes unresponsive.

### Root Causes Identified and Fixed

1. **Timing Issue**: The `showEventConfirmation` message was sent before the modal was fully created
2. **Missing Error Handling**: Silent failures in modal creation weren't being logged
3. **Hardcoded API Key**: Configuration wasn't properly validated
4. **Insufficient Logging**: Difficult to trace the exact failure point

### Fixes Implemented

#### 1. Enhanced Modal Creation Logic
- **File**: `src/content-script/index.ts`
- **Fix**: `showEventConfirmation()` now creates the modal if it doesn't exist
- **Benefit**: Handles timing issues between background and content script

```javascript
// Before: Failed silently if modal didn't exist
if (!modal) {
  console.error('[Content Script] Modal not found for event confirmation.')
  return
}

// After: Creates modal if missing
let overlay = document.getElementById(MODAL_OVERLAY_ID)
if (!overlay) {
  logger.warn('content-script', 'Modal overlay not found, creating it now')
  showConfirmationModal()
  overlay = document.getElementById(MODAL_OVERLAY_ID)
}
```

#### 2. Improved Error Handling and Logging
- **Enhanced Logging**: All functions now use structured logging
- **Error Catching**: Message listener wrapped in try-catch
- **Debug Functions**: Added browser console debugging utilities

#### 3. Removed Hardcoded API Key
- **File**: `src/config.ts`
- **Fix**: Throws clear error when no API key is configured
- **Benefit**: Forces proper configuration setup

#### 4. Better Message Passing
- **Enhanced Error Handling**: Background script catches and logs message sending failures
- **Detailed Logging**: More context in success/failure messages

### Debugging Tools

#### Browser Console Commands
After loading the extension, open browser console and use:

```javascript
// Test modal creation
extensionDebug.testModal()

// Test event confirmation with sample data
extensionDebug.testEventConfirmation()

// Check if modal elements exist
extensionDebug.checkModalExists()

// Hide modal
extensionDebug.hideModal()
```

#### Debug Logs
1. Open extension options page
2. Go to "Debug Logs" tab
3. Look for errors related to:
   - Modal creation failures
   - Message passing issues
   - API configuration problems

### Testing Steps

#### 1. Basic Modal Test
1. Open any webpage
2. Open browser console
3. Run: `extensionDebug.testModal()`
4. **Expected**: Modal with loading indicator appears
5. **If fails**: Check console for errors

#### 2. Event Confirmation Test
1. Run: `extensionDebug.testEventConfirmation()`
2. **Expected**: Modal shows event details with buttons
3. **If fails**: Check if modal was created first

#### 3. Full Integration Test
1. Select text with event information
2. Right-click → "Add to calendar"
3. **Expected**: Modal appears with extracted event details
4. **If fails**: Check debug logs for specific error

### Common Issues and Solutions

#### Issue 1: Modal Not Appearing
**Symptoms**: AI processing succeeds but no modal shows
**Debug Steps**:
1. Check console: `extensionDebug.checkModalExists()`
2. Look for content script errors in console
3. Verify content script is loaded on the page

**Solutions**:
- Refresh the page to reload content script
- Check if page has CSP restrictions
- Verify extension permissions

#### Issue 2: Webpage Becomes Unresponsive
**Symptoms**: Can't interact with page after right-click
**Cause**: Modal overlay blocking interactions but not visible
**Debug Steps**:
1. Check for invisible overlay: `document.getElementById('extension-modal-overlay')`
2. Force hide: `extensionDebug.hideModal()`

#### Issue 3: API Configuration Errors
**Symptoms**: "No AI provider configured" error
**Solution**:
1. Go to extension options
2. Configure API key in "AI Provider" tab
3. Save configuration

#### Issue 4: Content Script Not Loading
**Symptoms**: `extensionDebug` is undefined
**Solutions**:
1. Refresh the page
2. Check if extension is enabled
3. Verify manifest permissions

### Performance Monitoring

The extension tracks performance metrics:
- Event extraction time
- Success/failure rates
- Error types and frequency

Access these in the Debug Logs panel.

### Advanced Debugging

#### Enable Verbose Logging
Add this to browser console for more detailed logs:
```javascript
// Enable debug level logging
localStorage.setItem('extension-debug-level', 'debug')
```

#### Manual Message Testing
Test message passing directly:
```javascript
// Send test message to background script
chrome.runtime.sendMessage({action: 'test'})

// Send test message to content script
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {action: 'showModal'})
})
```

### Reporting Issues

When reporting issues, include:
1. Browser console errors
2. Extension debug logs (export from options page)
3. Steps to reproduce
4. Expected vs actual behavior
5. Browser and extension version

### Prevention

To prevent similar issues:
1. Always test modal creation independently
2. Use structured logging for all operations
3. Implement proper error boundaries
4. Test message passing timing
5. Validate configuration before use
