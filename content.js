// Content script for ETH Wallet Plugin
// This script runs on every webpage to interact with the wallet

console.log('ETH Wallet Plugin content script loaded');

// Inject wallet provider if needed (simulated)
window.ethereum = window.ethereum || {
  isMetaMask: true,
  chainId: '0x1', // Ethereum mainnet
  networkVersion: '1',
  
  // Mock request handler
  request: async (args) => {
    switch(args.method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        // Return a simulated account
        return new Promise(resolve => {
          setTimeout(() => {
            const fakeAccount = '0x' + Math.random().toString(16).substr(2, 40);
            resolve([fakeAccount]);
          }, 300);
        });
        
      case 'eth_getBalance':
        // Return a simulated balance
        return '0x' + Math.floor(Math.random() * 1000000000000000000).toString(16);
        
      case 'net_version':
        return '1';
        
      default:
        console.warn(`Unhandled method: ${args.method}`);
        return null;
    }
  },
  
  // Mock event listeners
  on: (event, handler) => {
    console.log(`Listening for ${event}`);
  }
};

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});