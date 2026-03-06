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

// Currently connected chain and wallet data
let currentChain = 'ethereum';
let currentRpcUrl = '';
let connectedWallet = null;
let walletProvider = null;

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
      address: connectedWallet?.address || null,
      balance: connectedWallet?.balance || '0',
      network: localStorage.getItem('network') || 'ethereum',
      chainName: CHAIN_CONFIGS[localStorage.getItem('network') || 'ethereum']?.name || 'Ethereum Mainnet',
      isConnected: !!connectedWallet
    };
    sendResponse(walletData);
  }
  
  if (request.action === 'connectWallet') {
    connectWallet(request.network || 'ethereum').then(response => {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'disconnectWallet') {
    disconnectWallet();
    sendResponse({ success: true });
  }
  
  if (request.action === 'switchNetwork') {
    switchNetwork(request.network).then(response => {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
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
  
  if (request.action === 'getNativeTokenBalance') {
    if (connectedWallet) {
      getNativeTokenBalance(connectedWallet.address, currentChain).then(balance => {
        connectedWallet.balance = balance;
        sendResponse({ balance });
      });
      return true; // Keep message channel open for async response
    } else {
      sendResponse({ balance: '0', error: 'Wallet not connected' });
    }
  }
  
  if (request.action === 'getTokenBalances') {
    if (connectedWallet) {
      getTokenBalances(connectedWallet.address, currentChain).then(tokens => {
        sendResponse({ tokens });
      });
      return true; // Keep message channel open for async response
    } else {
      sendResponse({ tokens: [], error: 'Wallet not connected' });
    }
  }
});

// Wallet management
let walletAccount = null;
let walletMnemonic = null;
let encryptedPrivateKey = null;

// Enhanced wallet connection function - NOW CREATES INTERNAL WALLET
async function connectWallet(chain = 'ethereum') {
  try {
    // Check if wallet already exists
    const storedWallet = await chrome.storage.local.get(['walletAccount', 'encryptedPrivateKey']);
    
    if (storedWallet.walletAccount && storedWallet.encryptedPrivateKey) {
      // Wallet already exists, decrypt private key and restore
      const privateKey = decryptPrivateKey(storedWallet.encryptedPrivateKey, 'temp_password'); // In real app, use secure password
      walletAccount = storedWallet.walletAccount;
      encryptedPrivateKey = storedWallet.encryptedPrivateKey;
      
      // Set current chain
      localStorage.setItem('network', chain);
      currentChain = chain;
      
      // Load RPC URLs for the selected chain
      await loadChainRpcUrls(chain);
      await setCurrentRpcForChain(chain);
      
      // Get balance
      const balance = await getNativeTokenBalance(walletAccount.address, chain);
      
      return {
        success: true,
        address: walletAccount.address,
        balance,
        network: chain,
        chainName: CHAIN_CONFIGS[chain]?.name || 'Ethereum Mainnet'
      };
    } else {
      // Create new wallet
      const newWallet = await createNewWallet();
      walletAccount = newWallet.account;
      walletMnemonic = newWallet.mnemonic;
      encryptedPrivateKey = newWallet.encryptedPrivateKey;
      
      // Store wallet securely
      await chrome.storage.local.set({
        walletAccount: newWallet.account,
        encryptedPrivateKey: newWallet.encryptedPrivateKey
      });
      
      // Set current chain
      localStorage.setItem('network', chain);
      currentChain = chain;
      
      // Load RPC URLs for the selected chain
      await loadChainRpcUrls(chain);
      await setCurrentRpcForChain(chain);
      
      // Get balance
      const balance = await getNativeTokenBalance(walletAccount.address, chain);
      
      return {
        success: true,
        address: walletAccount.address,
        balance,
        network: chain,
        chainName: CHAIN_CONFIGS[chain]?.name || 'Ethereum Mainnet',
        mnemonic: newWallet.mnemonic // Only provided on first creation
      };
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Create a new internal wallet
async function createNewWallet() {
  // Dynamically load ethers.js
  await loadEthersLibraryDynamically();
  
  // Generate new wallet
  const newWallet = window.ethers.Wallet.createRandom();
  
  // In a real implementation, we would encrypt the private key
  // For this demo, we'll just simulate encryption
  const encryptedKey = encryptPrivateKey(newWallet.privateKey, 'temp_password');
  
  return {
    account: {
      address: newWallet.address,
      publicKey: newWallet.publicKey,
    },
    mnemonic: newWallet.mnemonic.phrase,
    privateKey: newWallet.privateKey,
    encryptedPrivateKey: encryptedKey
  };
}

// Dynamic loading of ethers.js
async function loadEthersLibraryDynamically() {
  return new Promise((resolve, reject) => {
    if (window.ethers) {
      resolve(window.ethers);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
    script.onload = () => resolve(window.ethers);
    script.onerror = () => reject(new Error('Failed to load ethers library'));
    document.head.appendChild(script);
  });
}

// Encrypt private key (simplified implementation)
function encryptPrivateKey(privateKey, password) {
  // This is a simplified encryption - in reality, use proper encryption like scrypt
  // For demo purposes only
  return btoa(privateKey); // Base64 encoding (NOT secure in real applications)
}

// Decrypt private key
function decryptPrivateKey(encryptedKey, password) {
  // This is a simplified decryption - in reality, use proper decryption
  // For demo purposes only
  return atob(encryptedKey); // Base64 decoding (NOT secure in real applications)
}

// Improved wallet disconnection
function disconnectWallet() {
  // Don't clear stored wallet, just reset connection
  connectedWallet = null;
  currentChain = 'ethereum';
  localStorage.removeItem('network');
}

// Enhanced network switching
async function switchNetwork(newChain) {
  if (!CHAIN_CONFIGS[newChain]) {
    return { success: false, error: 'Unsupported network' };
  }

  localStorage.setItem('network', newChain);
  currentChain = newChain;
  
  // Load RPC URLs for the new chain
  await loadChainRpcUrls(newChain);
  await setCurrentRpcForChain(newChain);
  
  // If wallet is connected, update its state
  if (walletAccount) {
    const newBalance = await getNativeTokenBalance(walletAccount.address, newChain);
    return {
      success: true,
      network: newChain,
      chainName: CHAIN_CONFIGS[newChain].name,
      balance: newBalance
    };
  }
  
  return {
    success: true,
    network: newChain,
    chainName: CHAIN_CONFIGS[newChain].name
  };
}

// Function to get native token balance for a chain
async function getNativeTokenBalance(address, chain) {
  try {
    // Since we don't have real RPC connection in this demo, we'll simulate
    // In a real implementation, we would query the blockchain via RPC
    
    // Simulate different balances per network for demo
    const chainBalances = {
      ethereum: (Math.random() * 5).toFixed(4),
      polygon: (Math.random() * 100).toFixed(4),
      bsc: (Math.random() * 2).toFixed(4),
      arbitrum: (Math.random() * 3).toFixed(4),
      optimism: (Math.random() * 3).toFixed(4),
      avalanche: (Math.random() * 10).toFixed(4),
      fantom: (Math.random() * 50).toFixed(4),
      base: (Math.random() * 2).toFixed(4)
    };
    
    return chainBalances[chain] || '0.0000';
  } catch (error) {
    console.error(`Error getting balance for ${address} on ${chain}:`, error);
    return '0.0000';
  }
}

// Function to send a transaction (to be implemented fully)
async function sendTransaction(toAddress, amount, tokenSymbol = 'native') {
  try {
    if (!walletAccount) {
      throw new Error('Wallet not connected');
    }

    // Validate address
    if (!toAddress || !ethers.utils.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }

    // Validate amount
    const currentBalance = await getNativeTokenBalance(walletAccount.address, currentChain);
    if (parseFloat(amount) > parseFloat(currentBalance)) {
      throw new Error('Insufficient balance');
    }

    // In a real implementation, this would create and sign a transaction
    // Then broadcast it to the network via RPC
    
    // For now, simulate successful transaction
    return {
      success: true,
      txHash: '0x' + Math.random().toString(16).substring(2, 66), // Simulated TX hash
      from: walletAccount.address,
      to: toAddress,
      amount: amount,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error sending transaction:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Add new message handlers for wallet functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Existing handlers...

  if (request.action === 'getMnemonic') {
    if (walletMnemonic) {
      sendResponse({ mnemonic: walletMnemonic });
    } else {
      sendResponse({ error: 'No mnemonic available' });
    }
  }

  if (request.action === 'exportPrivateKey') {
    if (encryptedPrivateKey) {
      const decryptedKey = decryptPrivateKey(encryptedPrivateKey, 'temp_password');
      sendResponse({ privateKey: decryptedKey });
    } else {
      sendResponse({ error: 'No private key available' });
    }
  }

  if (request.action === 'sendTransaction') {
    sendTransaction(request.to, request.amount, request.tokenSymbol).then(result => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'createNewWallet') {
    createNewWallet().then(newWallet => {
      walletAccount = newWallet.account;
      walletMnemonic = newWallet.mnemonic;
      encryptedPrivateKey = newWallet.encryptedPrivateKey;

      // Store wallet securely
      chrome.storage.local.set({
        walletAccount: newWallet.account,
        encryptedPrivateKey: newWallet.encryptedPrivateKey
      });

      sendResponse({
        success: true,
        address: newWallet.account.address,
        mnemonic: newWallet.mnemonic
      });
    });
    return true; // Keep message channel open for async response
  }
});

// Enhanced wallet disconnection
function disconnectWallet() {
  connectedWallet = null;
  currentChain = 'ethereum';
  localStorage.removeItem('network');
}

// Enhanced network switching
async function switchNetwork(newChain) {
  if (!CHAIN_CONFIGS[newChain]) {
    return { success: false, error: 'Unsupported network' };
  }

  localStorage.setItem('network', newChain);
  currentChain = newChain;
  
  // Load RPC URLs for the new chain
  await loadChainRpcUrls(newChain);
  await setCurrentRpcForChain(newChain);
  
  // If wallet is connected, try to update its state
  if (connectedWallet) {
    const newBalance = await getNativeTokenBalance(connectedWallet.address, newChain);
    connectedWallet.balance = newBalance;
  }
  
  return {
    success: true,
    network: newChain,
    chainName: CHAIN_CONFIGS[newChain].name
  };
}

// Function to get native token balance for a chain
async function getNativeTokenBalance(address, chain) {
  try {
    const rpcUrl = await getActiveRpcUrl(chain);
    if (!rpcUrl) {
      throw new Error('No RPC URL available for chain: ' + chain);
    }
    
    // In a real implementation, this would make a proper eth_call
    // For now, return a simulated value based on chain
    const chainMultiplier = {
      ethereum: 1,
      polygon: 100,
      bsc: 0.1,
      arbitrum: 1,
      optimism: 1,
      avalanche: 5,
      fantom: 50,
      base: 1
    };
    
    const multiplier = chainMultiplier[chain] || 1;
    return (Math.random() * 10 * multiplier).toFixed(4);
  } catch (error) {
    console.error(`Error getting balance for ${address} on ${chain}:`, error);
    return '0.0000';
  }
}

// Function to get token balances
async function getTokenBalances(address, chain) {
  try {
    // Simulate fetching token balances
    const tokens = [];
    
    const tokenData = {
      ethereum: [
        { symbol: 'ETH', name: 'Ethereum', balance: Math.random().toFixed(4), decimals: 18 },
        { symbol: 'USDT', name: 'Tether', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'DAI', name: 'Dai', balance: (Math.random() * 500).toFixed(2), decimals: 18 },
        { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: (Math.random() * 0.1).toFixed(6), decimals: 8 }
      ],
      polygon: [
        { symbol: 'MATIC', name: 'Matic', balance: (Math.random() * 100).toFixed(4), decimals: 18 },
        { symbol: 'USDT', name: 'Tether', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'WMATIC', name: 'Wrapped Matic', balance: (Math.random() * 50).toFixed(4), decimals: 18 }
      ],
      bsc: [
        { symbol: 'BNB', name: 'Binance Coin', balance: (Math.random() * 5).toFixed(4), decimals: 18 },
        { symbol: 'BUSD', name: 'Binance USD', balance: (Math.random() * 1000).toFixed(2), decimals: 18 },
        { symbol: 'CAKE', name: 'PancakeSwap Token', balance: (Math.random() * 50).toFixed(4), decimals: 18 }
      ],
      arbitrum: [
        { symbol: 'ETH', name: 'Ethereum', balance: Math.random().toFixed(4), decimals: 18 },
        { symbol: 'ARB', name: 'Arbitrum', balance: (Math.random() * 100).toFixed(4), decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 }
      ],
      optimism: [
        { symbol: 'ETH', name: 'Ethereum', balance: Math.random().toFixed(4), decimals: 18 },
        { symbol: 'OP', name: 'Optimism', balance: (Math.random() * 100).toFixed(4), decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 }
      ],
      avalanche: [
        { symbol: 'AVAX', name: 'Avalanche', balance: (Math.random() * 10).toFixed(4), decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'JOE', name: 'JoeToken', balance: (Math.random() * 200).toFixed(4), decimals: 18 }
      ],
      fantom: [
        { symbol: 'FTM', name: 'Fantom', balance: (Math.random() * 100).toFixed(4), decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 },
        { symbol: 'SPELL', name: 'Spell Token', balance: (Math.random() * 10000).toFixed(0), decimals: 18 }
      ],
      base: [
        { symbol: 'ETH', name: 'Ethereum', balance: Math.random().toFixed(4), decimals: 18 },
        { symbol: 'BASE', name: 'Base', balance: (Math.random() * 1000).toFixed(4), decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin', balance: (Math.random() * 1000).toFixed(2), decimals: 6 }
      ]
    };
    
    return tokenData[chain] || tokenData.ethereum;
  } catch (error) {
    console.error('Error getting token balances:', error);
    return [];
  }
}

// Helper function to get active RPC URL for a chain
async function getActiveRpcUrl(chain) {
  const rpcList = await getStoredRpcUrls(chain);
  if (rpcList && rpcList.length > 0) {
    return rpcList[0]; // For simplicity, return the first one
  }
  return null;
}

// Helper function to generate a fake address for simulation
function generateFakeAddress() {
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Function to load RPC URLs for a chain from chainlist.org
async function loadChainRpcUrls(chainId) {
  try {
    const chainConfig = CHAIN_CONFIGS[chainId];
    if (!chainConfig) return [];
    
    // In a real implementation, fetch from chainlist.org
    // const response = await fetch('https://chainid.network/chains.json');
    // const chains = await response.json();
    // const chain = chains.find(c => c.chainId == CHAIN_CONFIGS[chainId].chainId.replace('0x', ''));
    // const rpcList = chain ? chain.rpc : getDefaultRpcUrls(chainId);
    
    // For now, using default RPCs
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

// Expose functions to global scope for potential use
globalThis.CHAIN_CONFIGS = CHAIN_CONFIGS;
globalThis.autoSwitchRpc = autoSwitchRpc;