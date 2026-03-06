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
    // Get user's tracked tokens from storage
    const storedTokens = await getTrackedTokens(chain);
    
    // If no tokens are tracked yet, use defaults
    if (storedTokens.length === 0) {
      const defaultTokens = getDefaultTokensForChain(chain);
      return defaultTokens.map(token => ({
        ...token,
        balance: generateRandomBalance(token.symbol, chain)
      }));
    }
    
    // Otherwise, return the stored tokens with balances
    return storedTokens.map(token => ({
      ...token,
      balance: generateRandomBalance(token.symbol, chain)
    }));
  } catch (error) {
    console.error('Error getting token balances:', error);
    return [];
  }
}

// Get tracked tokens from storage
async function getTrackedTokens(chain) {
  const result = await chrome.storage.local.get([`tracked_tokens_${chain}`]);
  return result[`tracked_tokens_${chain}`] || [];
}

// Set tracked tokens in storage
async function setTrackedTokens(chain, tokens) {
  await chrome.storage.local.set({ [`tracked_tokens_${chain}`]: tokens });
}

// Get default tokens for each chain
function getDefaultTokensForChain(chain) {
  const defaults = {
    ethereum: [
      { symbol: 'ETH', name: 'Ethereum', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      { symbol: 'DAI', name: 'Dai Stablecoin', contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
      { symbol: 'UNI', name: 'Uniswap', contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
      { symbol: 'LINK', name: 'ChainLink Token', contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
      { symbol: 'MATIC', name: 'Matic Token', contractAddress: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 }
    ],
    polygon: [
      { symbol: 'MATIC', name: 'Matic Token', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
      { symbol: 'DAI', name: 'Dai Stablecoin', contractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
      { symbol: 'WMATIC', name: 'Wrapped Matic', contractAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
      { symbol: 'WETH', name: 'Wrapped Ether', contractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
      { symbol: 'QUICK', name: 'Quickswap', contractAddress: '0xB5C064F955D8e7F38fE0460C556a72987494eE30', decimals: 18 },
      { symbol: 'AAVE', name: 'Aave', contractAddress: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18 }
    ],
    bsc: [
      { symbol: 'BNB', name: 'Binance Coin', contractAddress: 'native', decimals: 18 },
      { symbol: 'BUSD', name: 'Binance USD', contractAddress: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
      { symbol: 'CAKE', name: 'PancakeSwap Token', contractAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
      { symbol: 'XVS', name: 'Venus', contractAddress: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63', decimals: 18 },
      { symbol: 'ADA', name: 'Cardano Token', contractAddress: '0x3EE2200Efb0CB97490C1d41b68095C1037467185', decimals: 18 },
      { symbol: 'DOT', name: 'Polkadot Token', contractAddress: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18 }
    ],
    arbitrum: [
      { symbol: 'ETH', name: 'Ethereum', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      { symbol: 'ARB', name: 'Arbitrum', contractAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
      { symbol: 'GMX', name: 'GMX', contractAddress: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18 },
      { symbol: 'DPX', name: 'Dopex', contractAddress: '0x6C2C06790b3E4d0bBc5b8F2cD37540485dC1bEF8', decimals: 18 },
      { symbol: 'RDNT', name: 'Radiant Capital', contractAddress: '0x3082CC23568eA640225c2467653dBd76Eb52b29d', decimals: 18 },
      { symbol: 'JOE', name: 'JoeToken (Arb.)', contractAddress: '0x3CC1A3cEb86Fe2bA24d5C87C56Ac501dEdDE9020', decimals: 18 }
    ],
    optimism: [
      { symbol: 'ETH', name: 'Ethereum', contractAddress: 'native', decimals: 18 },
      { symbol: 'OP', name: 'Optimism', contractAddress: '0x4200000000000000000000000000000000000042', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
      { symbol: 'SNX', name: 'Synthetix', contractAddress: '0x8700dAec35aF8Ff88c1cFd7F3C6E2cBB6e0D5a9A', decimals: 18 },
      { symbol: 'SNX', name: 'Synthetix', contractAddress: '0x8700dAec35aF8Ff88c1cFd7F3C6E2cBB6e0D5a9A', decimals: 18 },
      { symbol: 'WETH', name: 'Wrapped Ether', contractAddress: '0x4200000000000000000000000000000000000006', decimals: 18 },
      { symbol: 'WBTC', name: 'Wrapped BTC', contractAddress: '0x68f180fcCe6836688e9084f08b44a8270D797C3D', decimals: 8 }
    ],
    avalanche: [
      { symbol: 'AVAX', name: 'Avalanche', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x9702230A888CAdCde16C8658D37D649b7E22a36C', decimals: 6 },
      { symbol: 'JOE', name: 'JoeToken', contractAddress: '0x6e84a6216eA6DACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18 },
      { symbol: 'GMX', name: 'GMX (Avax)', contractAddress: '0x62edc0692BD897D2295872a9FFCac5425011c661', decimals: 18 },
      { symbol: 'PNG', name: 'Pangolin', contractAddress: '0x60781C2586D68229fde47564546784ab3fACA982', decimals: 18 },
      { symbol: 'AAVE', name: 'Aave Token', contractAddress: '0x63a72806098Bd3D9520cC43356dD78afe5D386D9', decimals: 18 },
      { symbol: 'WAVAX', name: 'Wrapped AVAX', contractAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18 }
    ],
    fantom: [
      { symbol: 'FTM', name: 'Fantom', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', decimals: 6 },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x049d68029688eAbF473097a2fC38ef61633A3C7A', decimals: 6 },
      { symbol: 'fUSDT', name: 'Frapped USDT', contractAddress: '0x049d68029688eAbF473097a2fC38ef61633A3C7A', decimals: 6 },
      { symbol: 'SPIRIT', name: 'SpiritSwap Token', contractAddress: '0x5Cc61A78F164885776AA610fb0FE1257d23d38D8', decimals: 18 },
      { symbol: 'SUSHI', name: 'SushiToken', contractAddress: '0xae75A438b2E0cB8BbA9d6A32842C0DfD9c586CFa', decimals: 18 },
      { symbol: 'BOO', name: 'SpookyToken', contractAddress: '0x841FAD6EAe12c294c3bA51e97a4bBeDBb0eecaDd', decimals: 18 },
      { symbol: 'SPELL', name: 'Spell Token', contractAddress: '0x468003B688943977e6130F4F68F23faA961dCbe1', decimals: 18 }
    ],
    base: [
      { symbol: 'ETH', name: 'Ethereum', contractAddress: 'native', decimals: 18 },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
      { symbol: 'BASE', name: 'Base Token', contractAddress: '0x1DD80372C6b301b09365167b7409d544c04c9130', decimals: 18 },
      { symbol: 'WETH', name: 'Wrapped Ether', contractAddress: '0x4200000000000000000000000000000000000006', decimals: 18 },
      { symbol: 'CBETH', name: 'Coinbase Wrapped Staked ETH', contractAddress: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aA9CF00b4C2', decimals: 18 },
      { symbol: 'AERO', name: 'Aerodrome', contractAddress: '0x940188DB233b3DdCb99423FcDB0Ae697C3c6795e', decimals: 18 },
      { symbol: 'USDbC', name: 'USD Base Coin', contractAddress: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
      { symbol: 'COMP', name: 'Compound', contractAddress: '0x9e1028F5F1D5eDE59748FFceE5532509976840E0', decimals: 18 }
    ]
  };
  
  return defaults[chain] || defaults.ethereum;
}

// Generate random balance for demo purposes
function generateRandomBalance(symbol, chain) {
  // Different ranges for different token types
  if (['ETH', 'MATIC', 'BNB', 'AVAX', 'FTM', 'ARB', 'OP'].includes(symbol)) {
    // Native tokens - smaller amounts
    return (Math.random() * 5).toFixed(symbol === 'WBTC' || symbol === 'BTC' ? 6 : 4);
  } else if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol)) {
    // Stablecoins - wider range
    return (Math.random() * 10000).toFixed(2);
  } else {
    // Other tokens - vary by token
    const multipliers = {
      'WBTC': 0.01,
      'LINK': 5,
      'UNI': 10,
      'CAKE': 50,
      'SUSHI': 20,
      'SPELL': 10000,
      'GMX': 1
    };
    const multiplier = multipliers[symbol] || 10;
    return (Math.random() * multiplier).toFixed(symbol === 'WBTC' ? 6 : 4);
  }
}

// Function to add a new token to a user's portfolio
async function addTokenToPortfolio(chain, token) {
  try {
    let trackedTokens = await getTrackedTokens(chain);
    
    // Check if token already exists
    const existingToken = trackedTokens.find(t => t.contractAddress === token.contractAddress);
    if (existingToken) {
      console.log(`Token ${token.symbol} already exists in portfolio`);
      return { success: false, error: 'Token already in portfolio' };
    }
    
    // Add the new token
    trackedTokens.push(token);
    await setTrackedTokens(chain, trackedTokens);
    
    return { success: true, message: `Successfully added ${token.symbol} to portfolio` };
  } catch (error) {
    console.error('Error adding token to portfolio:', error);
    return { success: false, error: error.message };
  }
}

// Function to remove a token from user's portfolio
async function removeTokenFromPortfolio(chain, contractAddress) {
  try {
    let trackedTokens = await getTrackedTokens(chain);
    
    // Filter out the token to remove
    trackedTokens = trackedTokens.filter(token => token.contractAddress !== contractAddress);
    await setTrackedTokens(chain, trackedTokens);
    
    return { success: true, message: 'Successfully removed token from portfolio' };
  } catch (error) {
    console.error('Error removing token from portfolio:', error);
    return { success: false, error: error.message };
  }
}

// Function to search for tokens on a specific chain
async function searchTokens(chain, query) {
  const defaultTokens = getDefaultTokensForChain(chain);
  const userTokens = await getTrackedTokens(chain);
  
  // Combine user tokens and default tokens
  const allTokens = [...new Map([...defaultTokens, ...userTokens].map(item => [item.contractAddress, item])).values()];
  
  // Filter based on search query
  const filtered = allTokens.filter(token => 
    token.symbol.toLowerCase().includes(query.toLowerCase()) || 
    token.name.toLowerCase().includes(query.toLowerCase())
  );
  
  return filtered.slice(0, 10); // Limit to top 10 matches
}

// Function to get common tokens for a chain
async function getCommonTokensForChain(chain) {
  const defaultTokens = getDefaultTokensForChain(chain);
  const userTokens = await getTrackedTokens(chain);
  
  // Return top tokens combining defaults and user's additions
  return [...new Map([...defaultTokens, ...userTokens].map(item => [item.contractAddress, item])).values()].slice(0, 8);
}

// Function to import a token portfolio
async function importTokenPortfolio(chain, tokenList) {
  try {
    // Get current tracked tokens
    let trackedTokens = await getTrackedTokens(chain);
    
    // Add new tokens, avoiding duplicates
    for (const token of tokenList) {
      const exists = trackedTokens.some(t => t.contractAddress === token.contractAddress);
      if (!exists) {
        trackedTokens.push(token);
      }
    }
    
    // Save updated list
    await setTrackedTokens(chain, trackedTokens);
    
    return { success: true, message: `Successfully imported ${tokenList.length} tokens` };
  } catch (error) {
    console.error('Error importing token portfolio:', error);
    return { success: false, error: error.message };
  }
}

// Function to export a token portfolio
async function exportTokenPortfolio(chain) {
  try {
    const tokens = await getTrackedTokens(chain);
    return {
      success: true,
      tokens: tokens,
      chain: chain,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error exporting token portfolio:', error);
    return { success: false, error: error.message };
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