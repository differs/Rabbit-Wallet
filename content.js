// Content script for Rabbit Wallet Plugin
// This script runs on every webpage to provide wallet-injected functionality

console.log('Rabbit Wallet content script loaded');

// Inject wallet provider object to web pages
injectWalletProvider();

function injectWalletProvider() {
  // Define a script to be injected into the webpage context
  const scriptContent = `
    (function() {
      if (window.rabbitWalletInjected) return;
      window.rabbitWalletInjected = true;
      
      // Create the injected wallet provider
      window.ethereum = {
        isRabbitWallet: true,
        isMetaMask: false, // Not MetaMask
        isConnected: function() {
          return true; // Always connected when injected
        },
        request: async function(args) {
          return new Promise((resolve, reject) => {
            // Send the request to the extension
            const messageChannel = new MessageChannel();
            
            window.postMessage({
              target: 'rabbit-wallet-content-script',
              data: args
            }, '*');
            
            // Listen for the response
            const handleMessage = (event) => {
              if (event.data && event.data.source === 'rabbit-wallet-response') {
                window.removeEventListener('message', handleMessage);
                if (event.data.error) {
                  reject(event.data.error);
                } else {
                  resolve(event.data.result);
                }
              }
            };
            
            window.addEventListener('message', handleMessage);
          });
        },
        on: function(event, handler) {
          // For now, we'll just log events
          console.log('Rabbit Wallet event listener registered:', event);
        },
        enable: function() {
          return this.request({ method: 'eth_requestAccounts' });
        },
        send: function(method, params) {
          return this.request({ method, params });
        },
        sendAsync: function(payload, callback) {
          this.request(payload)
            .then(result => callback(null, { jsonrpc: '2.0', id: payload.id, result }))
            .catch(error => callback(error, null));
        }
      };
      
      // Notify dapps that provider is available
      window.dispatchEvent(new Event('ethereum#initialized'));
      window.dispatchEvent(new Event('rabbit_wallet#initialized'));
    })();
  `;

  // Create and inject the script tag
  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Listen for messages from the injected script
window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data || event.data.target !== 'rabbit-wallet-content-script') {
    return;
  }
  
  // Forward the request to the background script
  chrome.runtime.sendMessage({
    action: 'forwardRpcRequest',
    request: event.data.data
  }).then(response => {
    // Send response back to the injected script
    window.postMessage({
      source: 'rabbit-wallet-response',
      result: response.result,
      error: response.error
    }, '*');
  }).catch(error => {
    window.postMessage({
      source: 'rabbit-wallet-response',
      error: { message: error.message }
    }, '*');
  });
});

// Handle messages from sidebar
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
  
  // Forward RPC requests from the injected provider
  if (request.action === 'forwardRpcRequest') {
    // This will be handled by the background script
    // For now, we'll return a simulated response
    const response = handleRpcRequest(request.request);
    sendResponse(response);
  }
});

// Basic RPC request handler
function handleRpcRequest(request) {
  switch(request.method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      // Return the connected account
      // This would come from the background script in a real implementation
      return { result: ['0xSimulatedWalletAddressFromBackground'] };
    
    case 'eth_getBalance':
      // Return a simulated balance
      return { result: '0x' + Math.floor(Math.random() * 1000000000000000000).toString(16) };
    
    case 'eth_chainId':
      // Return current chain ID (would come from background)
      return { result: '0x1' }; // Ethereum mainnet as default
    
    case 'net_version':
      return { result: '1' };
    
    default:
      console.warn('Rabbit Wallet: Unhandled RPC method:', request.method);
      return { error: { message: `Method ${request.method} not implemented` } };
  }
}