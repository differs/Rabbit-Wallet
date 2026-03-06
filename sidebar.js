// ETH Wallet Plugin Sidebar Script

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const walletAddressEl = document.getElementById('walletAddress');
const walletStatusEl = document.getElementById('walletStatus');
const walletBalanceEl = document.getElementById('walletBalance');
const walletBalanceUsdEl = document.getElementById('walletBalanceUsd');
const ethBalanceEl = document.getElementById('ethBalance');
const interceptedCountEl = document.getElementById('intercepted-count');
const savedDataEl = document.getElementById('saved-data');
const savedTimeEl = document.getElementById('saved-time');
const exchangeBtn = document.getElementById('exchangeBtn');
const networkSelect = document.getElementById('networkSelect');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// State
let walletConnected = false;
let walletData = null;
let chains = [];

// Initialize the wallet plugin
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
  await loadStoredData();
  updateStatsPeriodically();
});

// Initialize app
async function initializeApp() {
  // Load chain configs
  await loadChainConfigs();
  
  // Load initial stats
  updateStatsDisplay();
  
  // Set up interval for updating stats
  setInterval(updateStatsDisplay, 5000);
}

// Load chain configurations
async function loadChainConfigs() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'getChainConfigs'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting chain configs:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      
      if (response && response.chains) {
        chains = response.chains;
        
        // Populate network select dropdown
        populateNetworkSelect();
        
        // Load current chain
        chrome.runtime.sendMessage({
          action: 'getCurrentChain'
        }, (chainResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting current chain:', chrome.runtime.lastError);
            return;
          }
          
          if (chainResponse) {
            networkSelect.value = chainResponse.currentChain;
          }
        });
      }
      resolve(chains);
    });
  });
}

// Populate network select dropdown
function populateNetworkSelect() {
  // Clear existing options except the first one
  while (networkSelect.children.length > 1) {
    networkSelect.removeChild(networkSelect.lastChild);
  }
  
  // Add chains to the dropdown
  chains.forEach(chain => {
    const option = document.createElement('option');
    option.value = chain.id;
    option.textContent = chain.name;
    networkSelect.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Connect/Disconnect wallet button
  connectBtn.addEventListener('click', toggleWalletConnection);
  
  // Exchange button
  exchangeBtn.addEventListener('click', () => {
    alert('Exchange functionality would open a modal or new view in a full implementation');
  });
  
  // Network selection
  networkSelect.addEventListener('change', () => {
    if (walletConnected) {
      chrome.runtime.sendMessage({
        action: 'switchNetwork',
        network: networkSelect.value
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error switching network:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          console.log('Network switched to:', response.network);
          
          // Update wallet display to reflect new network
          chrome.runtime.sendMessage({
            action: 'getWalletData'
          }, (walletResponse) => {
            if (walletResponse) {
              walletData = walletResponse;
              updateWalletDisplay();
            }
          });
        } else {
          console.error('Network switch failed:', response);
        }
      });
    } else {
      // Update the network selection for connection
      localStorage.setItem('selectedNetwork', networkSelect.value);
    }
  });
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  
  // Claim reward buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('claim-btn')) {
      e.target.textContent = 'Claimed!';
      e.target.disabled = true;
      e.target.style.backgroundColor = '#666';
      setTimeout(() => {
        e.target.textContent = 'Claim';
        e.target.disabled = false;
        e.target.style.backgroundColor = '';
      }, 3000);
    }
  });
  
  // Stake/Farm buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('stake') || e.target.classList.contains('farm')) {
      alert(`${e.target.textContent} functionality would be implemented in a full version`);
    }
  });
}

// Toggle wallet connection
async function toggleWalletConnection() {
  if (walletConnected) {
    // Disconnect wallet
    await disconnectWallet();
  } else {
    // Connect wallet
    await connectWallet();
  }
}

// Connect wallet
async function connectWallet() {
  try {
    const selectedNetwork = networkSelect.value || localStorage.getItem('selectedNetwork') || 'ethereum';
    
    // Show connecting state
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
    
    // Request connection from background script
    chrome.runtime.sendMessage({
      action: 'connectWallet',
      network: selectedNetwork
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error connecting wallet:', chrome.runtime.lastError);
        alert('Error connecting wallet: ' + chrome.runtime.lastError.message);
        connectBtn.textContent = 'Connect';
        connectBtn.disabled = false;
        return;
      }
      
      if (response && response.success) {
        walletConnected = true;
        walletData = response;
        updateWalletDisplay();
        console.log('Wallet connected successfully on network:', response.network);
        // Update network selection to match connected network
        networkSelect.value = response.network;
      } else {
        console.error('Wallet connection failed:', response);
        alert('Wallet connection failed: ' + (response?.error || 'Unknown error'));
      }
      
      // Re-enable button
      connectBtn.disabled = false;
    });
  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Error connecting wallet: ' + error.message);
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
  }
}

// Disconnect wallet
async function disconnectWallet() {
  try {
    // Show disconnecting state
    connectBtn.textContent = 'Disconnecting...';
    connectBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      action: 'disconnectWallet'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error disconnecting wallet:', chrome.runtime.lastError);
        alert('Error disconnecting wallet: ' + chrome.runtime.lastError.message);
        connectBtn.textContent = 'Disconnect';
        connectBtn.disabled = false;
        return;
      }
      
      if (response && response.success) {
        walletConnected = false;
        walletData = null;
        updateWalletDisplay();
        console.log('Wallet disconnected successfully');
      }
      
      // Re-enable button
      connectBtn.disabled = false;
    });
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    alert('Error disconnecting wallet: ' + error.message);
    connectBtn.textContent = 'Disconnect';
    connectBtn.disabled = false;
  }
}

// Load stored data
async function loadStoredData() {
  // Load wallet data from runtime
  chrome.runtime.sendMessage({
    action: 'getWalletData'
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting wallet data:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      walletData = response;
      walletConnected = response.isConnected;
      updateWalletDisplay();
    }
  });
  
  // Load stats from storage
  chrome.storage.local.get(['stats'], (result) => {
    if (result.stats) {
      updateStatsElements(result.stats);
    }
  });
  
  // Load current chain to set network select
  chrome.runtime.sendMessage({
    action: 'getCurrentChain'
  }, (chainResponse) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting current chain:', chrome.runtime.lastError);
      return;
    }
    
    if (chainResponse) {
      networkSelect.value = chainResponse.currentChain;
    }
  });
}

// Update wallet display
function updateWalletDisplay() {
  if (walletConnected && walletData) {
    // Update wallet status
    const statusIndicator = walletStatusEl.querySelector('.status-indicator');
    const statusText = walletStatusEl.querySelector('.status-text');
    
    statusIndicator.className = 'status-indicator connected';
    statusText.textContent = 'Connected';
    
    // Update wallet address (truncate if too long)
    const address = walletData.address;
    const truncatedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    walletAddressEl.textContent = truncatedAddress;
    
    // Update chain-specific info
    const chainSymbol = getChainSymbol(walletData.network) || 'ETH';
    
    // Update balance
    const balance = parseFloat(walletData.balance).toFixed(4);
    const usdBalance = (parseFloat(walletData.balance) * getApproximatePrice(walletData.network)).toFixed(2);
    
    walletBalanceEl.textContent = `${balance} ${chainSymbol}`;
    walletBalanceUsdEl.textContent = `$${usdBalance}`;
    
    // Update ETH balance element (this would be the native token)
    ethBalanceEl.textContent = balance;
    
    // Update connect button text
    connectBtn.textContent = 'Disconnect';
    connectBtn.style.background = '#ff3b30';
  } else {
    // Reset to disconnected state
    const statusIndicator = walletStatusEl.querySelector('.status-indicator');
    const statusText = walletStatusEl.querySelector('.status-text');
    
    statusIndicator.className = 'status-indicator disconnected';
    statusText.textContent = 'Disconnected';
    
    walletAddressEl.textContent = 'Connect Wallet';
    walletBalanceEl.textContent = '0.0000 ' + getChainSymbol(networkSelect.value);
    walletBalanceUsdEl.textContent = '$0.00';
    ethBalanceEl.textContent = '0.0000';
    
    connectBtn.textContent = 'Connect';
    connectBtn.style.background = '';
  }
}

// Get chain symbol based on network
function getChainSymbol(network) {
  const chain = chains.find(c => c.id === network);
  return chain ? chain.symbol : 'ETH';
}

// Get approximate price for network (for USD conversion)
function getApproximatePrice(network) {
  // Different approximate prices per network
  const prices = {
    ethereum: 2500,
    polygon: 0.70,
    bsc: 300,
    arbitrum: 2500, // ARB token price varies, using ETH for demo
    optimism: 2500, // OP token price varies, using ETH for demo
    avalanche: 35,
    fantom: 0.70,
    base: 2500, // ETH on Base
  };
  
  return prices[network] || 2500; // Default to ETH price
}

// Update stats display
function updateStatsDisplay() {
  // Generate random stats for demonstration
  const stats = {
    intercepted: Math.floor(Math.random() * 900000) + 100000,
    savedData: (Math.random() * 10 + 1).toFixed(2),
    savedTime: (Math.random() * 10 + 1).toFixed(1)
  };
  
  updateStatsElements(stats);
  
  // Also save to storage for persistence
  chrome.storage.local.set({ stats });
}

// Update stats elements
function updateStatsElements(stats) {
  if (stats) {
    // Format numbers with commas
    interceptedCountEl.textContent = stats.intercepted.toLocaleString();
    savedDataEl.textContent = `${stats.savedData} GB`;
    savedTimeEl.textContent = `${stats.savedTime} Hours`;
  }
}

// Update stats periodically
function updateStatsPeriodically() {
  // Update stats every 5 seconds
  setInterval(updateStatsDisplay, 5000);
}

// Switch between tabs
function switchTab(tabName) {
  // Remove active class from all buttons and panels
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabPanels.forEach(panel => panel.classList.remove('active'));
  
  // Add active class to clicked button
  const clickedButton = document.querySelector(`[data-tab="${tabName}"]`);
  clickedButton.classList.add('active');
  
  // Show corresponding panel
  const panelToShow = document.getElementById(`${tabName}-tab`);
  if (panelToShow) {
    panelToShow.classList.add('active');
  }
  
  // Save active tab in storage
  chrome.storage.local.set({ activeTab: tabName });
}

// Load saved active tab
function loadActiveTab() {
  chrome.storage.local.get(['activeTab'], (result) => {
    const activeTab = result.activeTab || 'stats';
    switchTab(activeTab);
  });
}

// Utility function to format large numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Initialize the active tab after DOM is loaded
setTimeout(loadActiveTab, 100);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateWalletData') {
    walletData = request.data;
    walletConnected = request.data.isConnected;
    updateWalletDisplay();
  }
  
  if (request.action === 'updateStats') {
    updateStatsElements(request.stats);
  }
  
  if (request.action === 'networkChanged') {
    // Handle network change from background
    if (request.network) {
      networkSelect.value = request.network;
      if (walletConnected) {
        chrome.runtime.sendMessage({
          action: 'getWalletData'
        }, (response) => {
          if (response) {
            walletData = response;
            updateWalletDisplay();
          }
        });
      }
    }
  }
});