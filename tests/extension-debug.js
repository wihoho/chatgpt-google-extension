/**
 * Extension Debug Helper
 * Run this in the browser console to debug extension issues
 */

// Global debug object for extension testing
window.extensionDebug = {
  
  // Test if content script is loaded
  testContentScript: function() {
    console.log('🔍 Testing content script...')
    
    if (typeof window.extensionContentScriptLoaded !== 'undefined') {
      console.log('✅ Content script loaded successfully')
      return true
    } else {
      console.log('❌ Content script not loaded')
      return false
    }
  },
  
  // Test background script communication
  testBackgroundConnection: async function() {
    console.log('🔍 Testing background script connection...')
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
      
      console.log('✅ Background script responding:', response)
      return response
    } catch (error) {
      console.log('❌ Background script not responding:', error.message)
      return { success: false, error: error.message }
    }
  },
  
  // Get current provider configuration
  checkCurrentProvider: async function() {
    console.log('🔍 Checking current provider configuration...')
    
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getCurrentProvider' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
      
      console.log('✅ Provider configuration:', response)
      return response
    } catch (error) {
      console.log('❌ Failed to get provider configuration:', error.message)
      return { success: false, error: error.message }
    }
  },
  
  // Test context menu functionality
  testContextMenu: function() {
    console.log('🔍 Testing context menu...')
    console.log('📋 Instructions:')
    console.log('1. Select some text on this page')
    console.log('2. Right-click on the selected text')
    console.log('3. Look for "Add to calendar" option in the context menu')
    console.log('4. Click it to test the functionality')
    
    // Select some test text automatically
    const testText = 'Team meeting tomorrow at 2:00 PM in Conference Room A'
    const textNode = document.createTextNode(testText)
    const span = document.createElement('span')
    span.appendChild(textNode)
    span.style.cssText = `
      background: yellow;
      padding: 5px;
      border: 2px dashed red;
      display: inline-block;
      margin: 10px;
      font-weight: bold;
    `
    
    // Add to page
    document.body.appendChild(span)
    
    // Select the text
    const range = document.createRange()
    range.selectNodeContents(span)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    
    console.log('✅ Test text added and selected:', testText)
    console.log('👆 Right-click on the highlighted text above to test context menu')
  },
  
  // Get extension information
  getExtensionInfo: function() {
    console.log('🔍 Getting extension information...')
    
    const info = {
      extensionId: chrome.runtime.id,
      manifest: chrome.runtime.getManifest(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      contentScriptLoaded: typeof window.extensionContentScriptLoaded !== 'undefined'
    }
    
    console.log('📊 Extension Info:', info)
    return info
  },
  
  // Test storage functionality
  testStorage: async function() {
    console.log('🔍 Testing storage functionality...')
    
    try {
      // Test write
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ debugTest: 'test-value-' + Date.now() }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
      
      // Test read
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(['debugTest'], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      })
      
      console.log('✅ Storage test successful:', result)
      return { success: true, data: result }
    } catch (error) {
      console.log('❌ Storage test failed:', error.message)
      return { success: false, error: error.message }
    }
  },
  
  // Run all tests
  runAllTests: async function() {
    console.log('🚀 Running all extension debug tests...')
    console.log('=' .repeat(50))
    
    const results = {
      extensionInfo: this.getExtensionInfo(),
      contentScript: this.testContentScript(),
      backgroundScript: await this.testBackgroundConnection(),
      storage: await this.testStorage(),
      provider: await this.checkCurrentProvider()
    }
    
    console.log('📊 All test results:', results)
    
    // Summary
    const passed = Object.values(results).filter(r => 
      r === true || (typeof r === 'object' && r.success !== false)
    ).length
    
    const total = Object.keys(results).length
    
    console.log('=' .repeat(50))
    console.log(`📈 Test Summary: ${passed}/${total} tests passed`)
    
    if (passed === total) {
      console.log('🎉 All tests passed! Extension is working correctly.')
      console.log('💡 If you\'re still having issues, try:')
      console.log('   1. Refresh this page')
      console.log('   2. Reload the extension')
      console.log('   3. Check for any console errors')
    } else {
      console.log('⚠️ Some tests failed. Check the results above for details.')
    }
    
    // Test context menu last (as it modifies the page)
    this.testContextMenu()
    
    return results
  },
  
  // Get content script info
  getContentScriptInfo: function() {
    return {
      loaded: typeof window.extensionContentScriptLoaded !== 'undefined',
      url: window.location.href,
      domain: window.location.hostname,
      protocol: window.location.protocol,
      timestamp: new Date().toISOString()
    }
  }
}

// Auto-run basic tests when script loads
console.log('🔧 Extension Debug Helper loaded')
console.log('💡 Run extensionDebug.runAllTests() to test everything')
console.log('💡 Or run individual tests like extensionDebug.testContentScript()')

// Show quick status
console.log('📊 Quick Status:')
console.log('   Content Script:', window.extensionDebug.testContentScript() ? '✅' : '❌')
console.log('   Extension ID:', chrome.runtime?.id || '❌ Not available')
console.log('   Page URL:', window.location.href)
