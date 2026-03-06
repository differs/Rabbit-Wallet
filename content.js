// Content script for ETH Wallet Plugin
// This script runs on every webpage to interact with the wallet

console.log('ETH Wallet Plugin content script loaded');

// Message listener for requests from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method === 'eth_requestAccounts') {
    // Handle request for accounts
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
          sendResponse(accounts);
        })
        .catch(error => {
          console.error('Error requesting accounts:', error);
          sendResponse(null);
        });
      return true; // Will respond asynchronously
    } else {
      // If no provider, return null
      sendResponse(null);
    }
  }
  
  if (request.action === 'interceptRequest') {
    // Simulate intercepting a request
    console.log('Intercepting request:', request.data);
    
    // Send to background to update stats
    chrome.runtime.sendMessage({
      action: 'interceptRequest',
      data: request.data
    });
    
    sendResponse({ success: true });
  }
  
  // Handle generic RPC requests
  if (request.method && window.ethereum) {
    window.ethereum.request(request)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error(`Error with RPC request ${request.method}:`, error);
        sendResponse(null);
      });
    return true; // Will respond asynchronously
  }
});

// Detect if wallet providers are available
(function detectProviders() {
  // Check for MetaMask
  const isMetaMask = window.ethereum && window.ethereum.isMetaMask;
  // Check for Coinbase
  const isCoinbase = window.ethereum && window.ethereum.isCoinbaseWallet;
  // Check for WalletConnect
  const isWalletConnect = window.ethereum && window.ethereum.isWalletConnect;
  
  // Notify background of provider availability
  chrome.runtime.sendMessage({
    action: 'walletProvidersDetected',
    providers: {
      metamask: !!isMetaMask,
      coinbase: !!isCoinbase,
      walletconnect: !!isWalletConnect,
      any: !!(window.ethereum)
    }
  });
})();