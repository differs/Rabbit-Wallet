// Background script for ETH Wallet Plugin
// Handles wallet initialization, side panel registration, and multi-chain support

// Chain configurations with default RPCs
const CHAIN_CONFIGS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: '0x1',
    symbol: 'ETH',
    rpcUrls: [],
    explorer: 'https://etherscan.io'
  },
  polygon: {
    name: 'Polygon',
    chainId: '0x89',
    symbol: 'MATIC',
    rpcUrls: [],
    explorer: 'https://polygonscan.com'
  },
  bsc: {
    name: 'Binance Smart Chain',
    chainId: '0x38',
    symbol: 'BNB',
    rpcUrls: [],
    explorer: 'https://bscscan.com'
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: '0xa4b1',
    symbol: 'ARB',
    rpcUrls: [],
    explorer: 'https://arbiscan.io'
  },
  optimism: {
    name: 'Optimism',
    chainId: '0xa',
    symbol: 'OP',
    rpcUrls: [],
    explorer: 'https://optimistic.etherscan.io'
  },
  avalanche: {
    name: 'Avalanche',
    chainId: '0xa86a',
    symbol: 'AVAX',
    rpcUrls: [],
    explorer: 'https://snowtrace.io'
  },
  fantom: {
    name: 'Fantom',
    chainId: '0xfa',
    symbol: 'FTM',
    rpcUrls: [],
    explorer: 'https://ftmscan.com'
  },
  base: {
    name: 'Base',
    chainId: '0x2105',
    symbol: 'ETH',
    rpcUrls: [],
    explorer: 'https://basescan.org'
  }
};

// Currently connected chain
let currentChain = 'ethereum';
let currentRpcUrl = '';

// Register side panel when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  console.log('ETH Wallet Plugin installed');
  
  // Initialize default chain
  chrome.storage.local.set({ 
    currentChain: 'ethereum',
    currentRpcUrl: ''
  });
});

// Listen for tab updates to manage side panel
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    // Enable side panel for all URLs
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: true
    }).catch((error) => {
      console.error('Failed to set side panel options:', error);
    });
  }
});

// Handle messages from sidebar or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getWalletData') {
    // Get wallet data with chain support
    const walletData = {
      address: localStorage.getItem('walletAddress') || null,
      balance: localStorage.getItem('walletBalance') || '0',
      network: localStorage.getItem('network') || 'ethereum',
      chainName: CHAIN_CONFIGS[localStorage.getItem('network') || 'ethereum']?.name || 'Ethereum Mainnet',
      isConnected: !!localStorage.getItem('walletAddress')
    };
    sendResponse(walletData);
  }
  
  if (request.action === 'connectWallet') {
    // Connect to wallet for specific chain
    const chain = request.network || 'ethereum';
    const fakeAddress = '0x' + Math.random().toString(16).substr(2, 40);
    
    localStorage.setItem('walletAddress', fakeAddress);
    localStorage.setItem('walletBalance', (Math.random() * 10).toFixed(4));
    localStorage.setItem('network', chain);
    currentChain = chain;
    
    // Load RPC URLs for the selected chain
    loadChainRpcUrls(chain).then(() => {
      setCurrentRpcForChain(chain);
    });
    
    sendResponse({
      success: true,
      address: fakeAddress,
      balance: localStorage.getItem('walletBalance'),
      network: localStorage.getItem('network'),
      chainName: CHAIN_CONFIGS[chain]?.name || 'Ethereum Mainnet'
    });
  }
  
  if (request.action === 'disconnectWallet') {
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletBalance');
    localStorage.removeItem('network');
    currentChain = 'ethereum';
    
    sendResponse({ success: true });
  }
  
  if (request.action === 'switchNetwork') {
    const newChain = request.network;
    if (CHAIN_CONFIGS[newChain]) {
      localStorage.setItem('network', newChain);
      currentChain = newChain;
      
      // Try to set RPC for new chain
      loadChainRpcUrls(newChain).then(() => {
        setCurrentRpcForChain(newChain);
      });
      
      sendResponse({
        success: true,
        network: newChain,
        chainName: CHAIN_CONFIGS[newChain].name
      });
    } else {
      sendResponse({ success: false, error: 'Unsupported network' });
    }
  }
  
  if (request.action === 'getChainConfigs') {
    sendResponse({
      chains: Object.keys(CHAIN_CONFIGS).map(key => ({
        id: key,
        name: CHAIN_CONFIGS[key].name,
        symbol: CHAIN_CONFIGS[key].symbol
      }))
    });
  }
  
  if (request.action === 'getCurrentChain') {
    const network = localStorage.getItem('network') || 'ethereum';
    sendResponse({
      currentChain: network,
      chainName: CHAIN_CONFIGS[network]?.name || 'Ethereum Mainnet',
      chainId: CHAIN_CONFIGS[network]?.chainId || '0x1'
    });
  }
  
  if (request.action === 'getChainRpcUrls') {
    const chain = request.chain || currentChain;
    getStoredRpcUrls(chain).then(rpcUrls => {
      sendResponse({ rpcUrls });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'testRpcConnection') {
    testRpcConnection(request.rpcUrl).then(isValid => {
      sendResponse({ isValid });
    });
    return true; // Keep message channel open for async response
  }
});

// Function to load RPC URLs for a chain from chainlist.org
async function loadChainRpcUrls(chainId) {
  try {
    // For now, using default RPCs or fallbacks
    // In a real implementation, this would fetch from chainlist.org
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) return [];
    
    // Hardcoded RPC lists for demonstration
    // In a real implementation, fetch from chainlist.org
    const rpcList = getDefaultRpcUrls(chainId);
    
    // Store RPC URLs in local storage
    await chrome.storage.local.set({ 
      [`rpc_${chainId}`]: rpcList 
    });
    
    return rpcList;
  } catch (error) {
    console.error(`Error loading RPCs for ${chainId}:`, error);
    return [];
  }
}

// Get default RPC URLs
function getDefaultRpcUrls(chainId) {
  const defaultRpcs = {
    ethereum: [
      'https://eth-mainnet.g.alchemy.com/v2/',
      'https://mainnet.infura.io/v3/',
      'https://cloudflare-eth.com',
      'https://ethereum.publicnode.com'
    ],
    polygon: [
      'https://polygon-mainnet.g.alchemy.com/v2/',
      'https://polygon-rpc.com',
      'https://matic-mainnet.chainstacklabs.com',
      'https://rpc-mainnet.maticvigil.com'
    ],
    bsc: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc.publicnode.com',
      'https://bscrpc.com'
    ],
    arbitrum: [
      'https://arbitrum-mainnet.infura.io/v3/',
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one.publicnode.com'
    ],
    optimism: [
      'https://optimism-mainnet.infura.io/v3/',
      'https://mainnet.optimism.io',
      'https://optimism.publicnode.com'
    ],
    avalanche: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.publicnode.com',
      'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc'
    ],
    fantom: [
      'https://rpc.ftm.tools',
      'https://rpcapi.fantom.network',
      'https://fantom.publicnode.com'
    ],
    base: [
      'https://mainnet.base.org',
      'https://base.publicnode.com',
      'https://base-mainnet.g.alchemy.com/v2/'
    ]
  };
  
  return defaultRpcs[chainId] || [];
}

// Get stored RPC URLs for a chain
async function getStoredRpcUrls(chainId) {
  const result = await chrome.storage.local.get([`rpc_${chainId}`]);
  return result[`rpc_${chainId}`] || getDefaultRpcUrls(chainId);
}

// Set current RPC for the active chain
async function setCurrentRpcForChain(chainId) {
  const rpcList = await getStoredRpcUrls(chainId);
  if (rpcList && rpcList.length > 0) {
    currentRpcUrl = rpcList[0]; // Start with the first RPC
    await chrome.storage.local.set({ currentRpcUrl });
  }
}

// Test RPC connection
async function testRpcConnection(rpcUrl) {
  try {
    // Create a minimal JSON-RPC request to test the endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: Date.now()
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return data && data.result && typeof data.result === 'string';
  } catch (error) {
    console.error('RPC test failed for', rpcUrl, ':', error.message);
    return false;
  }
}

// Monitor RPC health and auto-switch if needed
async function monitorRpcHealth() {
  if (!currentChain || !currentRpcUrl) return;
  
  const isValid = await testRpcConnection(currentRpcUrl);
  if (!isValid) {
    console.log(`Current RPC ${currentRpcUrl} is not responding, attempting switch...`);
    const switched = await autoSwitchRpc(currentChain);
    if (!switched) {
      console.warn('No working RPC available!');
      // Could notify the UI about RPC issues
    }
  }
}

// Set up RPC health monitoring
setInterval(monitorRpcHealth, 30000); // Check every 30 seconds

// Auto-switch to next available RPC when current fails
async function autoSwitchRpc(chainId) {
  const rpcList = await getStoredRpcUrls(chainId);
  if (!rpcList || rpcList.length <= 1) return false;
  
  // Find currently active RPC
  const currentRpc = await chrome.storage.local.get(['currentRpcUrl']);
  const currentIndex = rpcList.indexOf(currentRpc.currentRpcUrl || rpcList[0]);
  
  // Try next RPCs starting from the next position
  for (let i = 1; i < rpcList.length; i++) {
    const nextIndex = (currentIndex + i) % rpcList.length;
    const rpcUrl = rpcList[nextIndex];
    
    if (await testRpcConnection(rpcUrl)) {
      currentRpcUrl = rpcUrl;
      await chrome.storage.local.set({ currentRpcUrl: rpcUrl });
      console.log(`Switched to new RPC: ${rpcUrl}`);
      return true;
    }
  }
  
  return false; // No working RPC found
}

// Set up a periodic update for stats
setInterval(() => {
  // Update stats in storage for sidebar to access
  const stats = {
    intercepted: Math.floor(Math.random() * 900000) + 100000,
    savedData: (Math.random() * 10).toFixed(2),
    savedTime: (Math.random() * 10).toFixed(1)
  };
  
  // Store stats in chrome.storage.local for sidebar access
  chrome.storage.local.set({ stats });
}, 5000);

// Expose functions to global scope for potential use
globalThis.CHAIN_CONFIGS = CHAIN_CONFIGS;
globalThis.autoSwitchRpc = autoSwitchRpc;