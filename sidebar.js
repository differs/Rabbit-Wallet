// Rabbit Wallet Plugin Sidebar Script

// Load ethers.js library
async function loadEthersLibrary() {
  if (typeof window.ethers !== 'undefined') {
    return;
  }
  
  // Load ethers library dynamically if not available
  const script = document.createElement('script');
  script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
  document.head.appendChild(script);
  
  // Wait for the script to load
  await new Promise((resolve) => {
    script.onload = resolve;
  });
}

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

// Add event listeners for transfer functionality
document.addEventListener('DOMContentLoaded', () => {
  // Transfer modal triggers
  const transferTrigger = document.getElementById('transferTrigger');
  const closeTransfer = document.getElementById('closeTransfer');
  const transferModal = document.getElementById('transferModal');
  const sendTransferBtn = document.getElementById('sendTransfer');
  
  if (transferTrigger) {
    transferTrigger.addEventListener('click', () => {
      transferModal.style.display = 'flex';
    });
  }
  
  if (closeTransfer) {
    closeTransfer.addEventListener('click', () => {
      transferModal.style.display = 'none';
    });
  }
  
  if (sendTransferBtn) {
    sendTransferBtn.addEventListener('click', initiateTransfer);
  }
});

// Initiate transfer
async function initiateTransfer() {
  const recipientAddress = document.getElementById('recipientAddress').value;
  const transferAmount = document.getElementById('transferAmount').value;
  const transferToken = document.getElementById('transferToken').value;
  
  // Basic validation
  if (!recipientAddress) {
    alert('Please enter a recipient address');
    return;
  }
  
  if (!transferAmount || parseFloat(transferAmount) <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  // Confirm transaction
  if (!confirm(`Send ${transferAmount} ${transferToken.toUpperCase()} to ${recipientAddress}?`)) {
    return;
  }
  
  // Show processing state
  const sendBtn = document.getElementById('sendTransfer');
  const originalText = sendBtn.textContent;
  sendBtn.textContent = 'Processing...';
  sendBtn.disabled = true;
  
  // Send transaction via background script
  chrome.runtime.sendMessage({
    action: 'sendTransaction',
    to: recipientAddress,
    amount: transferAmount,
    tokenSymbol: transferToken
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending transaction:', chrome.runtime.lastError);
      alert('Error sending transaction: ' + chrome.runtime.lastError.message);
      sendBtn.textContent = originalText;
      sendBtn.disabled = false;
      return;
    }
    
    if (response && response.success) {
      alert(`Transaction sent successfully!\nTX Hash: ${response.txHash}`);
      document.getElementById('transferModal').style.display = 'none';
      
      // Clear form
      document.getElementById('recipientAddress').value = '';
      document.getElementById('transferAmount').value = '';
    } else {
      alert('Transaction failed: ' + (response?.error || 'Unknown error'));
    }
    
    // Reset button
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  });
}
      
      if (response && response.success) {
        walletConnected = true;
        walletData = response;
        console.log('Wallet connected successfully on network:', response.network);
        // Update network selection to match connected network
        networkSelect.value = response.network;
        
        // Update the display after a brief moment to allow for data sync
        setTimeout(() => {
          updateWalletDisplay();
          loadTokenBalances(); // Load token balances after connection
        }, 500);
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
        console.log('Wallet connected successfully on network:', response.network);
        // Update network selection to match connected network
        networkSelect.value = response.network;
        
        // Handle mnemonic display on first creation
        if (response.mnemonic) {
          showMnemonicBackup(response.mnemonic);
        }
        
        // Update the display after a brief moment to allow for data sync
        setTimeout(() => {
          updateWalletDisplay();
          loadTokenBalances(); // Load token balances after connection
        }, 500);
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

// Show mnemonic backup screen
function showMnemonicBackup(mnemonic) {
  // Create a modal or overlay to show the mnemonic
  const overlay = document.createElement('div');
  overlay.id = 'mnemonic-backup-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  overlay.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      padding: 25px;
      border-radius: 12px;
      max-width: 90%;
      width: 400px;
      text-align: center;
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(10px);
    ">
      <h3 style="color: var(--text-primary); margin-bottom: 15px;">Backup Your Recovery Phrase</h3>
      <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
        Write down these 12 words in order. This is the only way to recover your wallet.
      </p>
      <div style="
        background: var(--bg-tertiary);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-family: monospace;
        word-break: break-all;
        color: var(--text-primary);
        font-size: 16px;
        line-height: 1.8;
      ">${mnemonic}</div>
      <button id="backup-done-btn" style="
        background: var(--accent-color);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      ">I've Saved It</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  document.getElementById('backup-done-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
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
async function updateWalletDisplay() {
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
    
    // Update balance - get fresh balance from background
    chrome.runtime.sendMessage({
      action: 'getNativeTokenBalance'
    }, (balanceResponse) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting balance:', chrome.runtime.lastError);
        return;
      }
      
      if (balanceResponse && balanceResponse.balance) {
        const balance = parseFloat(balanceResponse.balance).toFixed(4);
        const usdBalance = (parseFloat(balanceResponse.balance) * getApproximatePrice(walletData.network)).toFixed(2);
        
        walletBalanceEl.textContent = `${balance} ${chainSymbol}`;
        walletBalanceUsdEl.textContent = `$${usdBalance}`;
        ethBalanceEl.textContent = balance;
      }
    });
    
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

// Load token balances for the connected wallet
async function loadTokenBalances() {
  if (!walletConnected) return;
  
  chrome.runtime.sendMessage({
    action: 'getTokenBalances'
  }, (tokenResponse) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting token balances:', chrome.runtime.lastError);
      return;
    }
    
    if (tokenResponse && tokenResponse.tokens) {
      updateTokenList(tokenResponse.tokens);
    }
  });
}

// Update the token list in the UI
function updateTokenList(tokens) {
  const tokenListElement = document.querySelector('.token-list');
  if (!tokenListElement) return;
  
  // Clear existing tokens
  tokenListElement.innerHTML = '';
  
  // Add each token to the list
  tokens.forEach(token => {
    const tokenElement = document.createElement('div');
    tokenElement.className = 'token-item';
    
    // Determine token icon based on symbol
    const tokenIconClass = getTokenIconClass(token.symbol);
    
    tokenElement.innerHTML = `
      <div class="token-icon ${tokenIconClass}">${token.symbol.charAt(0)}</div>
      <div class="token-info">
        <div class="token-name">${token.name}</div>
        <div class="token-symbol">${token.symbol}</div>
      </div>
      <div class="token-balance">${parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
    `;
    
    tokenListElement.appendChild(tokenElement);
  });
}

// Get appropriate icon class for token symbol
function getTokenIconClass(symbol) {
  const symbols = {
    'ETH': 'eth',
    'MATIC': 'polygon',
    'BNB': 'bsc',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'AVAX': 'avalanche',
    'FTM': 'fantom',
    'BASE': 'base',
    'USDC': 'usdc',
    'USDT': 'usdt',
    'DAI': 'dai',
    'WBTC': 'wbtc',
    'BUSD': 'busd',
    'CAKE': 'cake',
    'JOE': 'joe',
    'SPELL': 'spell',
    'WETH': 'eth',
    'WMATIC': 'polygon',
    'QUICK': 'polygon',
    'AAVE': 'eth',
    'XVS': 'bsc',
    'ADA': 'bsc',
    'DOT': 'bsc',
    'GMX': 'arbitrum',
    'DPX': 'arbitrum',
    'RDNT': 'arbitrum',
    'SNX': 'optimism',
    'PNG': 'avalanche',
    'WAVAX': 'avalanche',
    'SPIRIT': 'fantom',
    'BOO': 'fantom',
    'COMP': 'eth',
    'CBETH': 'eth',
    'AERO': 'base',
    'USDbC': 'base',
    'fUSDT': 'fantom'
  };
  
  return symbols[symbol.toUpperCase()] || 'default';
}

// Add token management functionality
document.addEventListener('DOMContentLoaded', () => {
  // ... existing code ...

  // Add token search functionality if on tokens tab
  setupTokenManagement();
});

// Set up token management UI
function setupTokenManagement() {
  // Create add token button in the token section
  const tokensTab = document.getElementById('tokens-tab');
  if (tokensTab) {
    // Create search token bar
    const searchContainer = document.createElement('div');
    searchContainer.className = 'token-search-container';
    searchContainer.innerHTML = `
      <div class="search-bar">
        <input type="text" id="tokenSearch" placeholder="Search tokens..." />
        <button id="addTokenBtn" class="add-token-btn">Add Token</button>
      </div>
      <div class="token-management-buttons">
        <button id="importTokensBtn" class="management-btn">Import Tokens</button>
        <button id="exportTokensBtn" class="management-btn">Export Tokens</button>
      </div>
      <div id="searchResults" class="search-results" style="display: none;"></div>
    `;
    
    // Insert after the h3 element
    const h3Element = tokensTab.querySelector('h3');
    if (h3Element) {
      h3Element.insertAdjacentElement('afterend', searchContainer);
      
      // Add event listeners
      document.getElementById('tokenSearch').addEventListener('input', handleTokenSearch);
      document.getElementById('addTokenBtn').addEventListener('click', showAddTokenModal);
      document.getElementById('importTokensBtn').addEventListener('click', showImportTokensModal);
      document.getElementById('exportTokensBtn').addEventListener('click', exportTokens);
    }
  }
}

// Show import tokens modal
function showImportTokensModal() {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'importTokensModal';
  modalOverlay.style.display = 'flex';
  
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Import Tokens</h3>
        <span class="close-modal" id="closeImportTokens">&times;</span>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label for="importTokensData">Paste Token Data (JSON format)</label>
          <textarea id="importTokensData" rows="8" placeholder='[{ "contractAddress": "...", "symbol": "...", "name": "...", "decimals": 18 }, ...]'></textarea>
        </div>
        <button class="action-btn import-tokens-btn" id="doImportTokens">Import Tokens</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  // Add event listeners
  document.getElementById('closeImportTokens').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  document.getElementById('doImportTokens').addEventListener('click', importTokensData);
}

// Import tokens from JSON data
async function importTokensData() {
  const tokenDataStr = document.getElementById('importTokensData').value.trim();
  
  if (!tokenDataStr) {
    alert('Please enter token data to import');
    return;
  }
  
  try {
    const tokenData = JSON.parse(tokenDataStr);
    
    if (!Array.isArray(tokenData)) {
      alert('Token data must be an array of token objects');
      return;
    }
    
    // Validate each token object
    for (const token of tokenData) {
      if (!token.contractAddress || !token.symbol || !token.name || typeof token.decimals === 'undefined') {
        alert(`Invalid token object: ${JSON.stringify(token)}. Must include contractAddress, symbol, name, and decimals.`);
        return;
      }
    }
    
    // Send to background to import
    chrome.runtime.sendMessage({
      action: 'importTokenPortfolio',
      chain: localStorage.getItem('network') || 'ethereum',
      tokenList: tokenData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error importing tokens:', chrome.runtime.lastError);
        alert('Error importing tokens: ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response && response.success) {
        alert(response.message);
        // Close modal
        const modal = document.getElementById('importTokensModal');
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
        // Refresh token list
        loadTokenBalances();
      } else {
        alert('Error importing tokens: ' + response.error);
      }
    });
  } catch (error) {
    alert('Invalid JSON format: ' + error.message);
  }
}

// Export tokens
async function exportTokens() {
  chrome.runtime.sendMessage({
    action: 'exportTokenPortfolio',
    chain: localStorage.getItem('network') || 'ethereum'
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error exporting tokens:', chrome.runtime.lastError);
      alert('Error exporting tokens: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response && response.success) {
      // Create and download the JSON file
      const dataStr = JSON.stringify(response.tokens, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `rabbit-wallet-tokens-${response.chain}-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } else {
      alert('Error exporting tokens: ' + response.error);
    }
  });
}

// Handle token search
async function handleTokenSearch(e) {
  const query = e.target.value.trim();
  const searchResults = document.getElementById('searchResults');
  
  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }
  
  // Send search request to background
  chrome.runtime.sendMessage({
    action: 'searchTokens',
    chain: localStorage.getItem('network') || 'ethereum',
    query: query
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error searching tokens:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.tokens) {
      displaySearchResults(response.tokens, searchResults);
    }
  });
}

// Display search results
function displaySearchResults(tokens, container) {
  if (tokens.length === 0) {
    container.innerHTML = '<div class="no-results">No tokens found</div>';
    container.style.display = 'block';
    return;
  }
  
  let resultsHtml = '<div class="search-results-list">';
  tokens.forEach(token => {
    const tokenIconClass = getTokenIconClass(token.symbol);
    resultsHtml += `
      <div class="search-result-item" data-token='${JSON.stringify(token)}'>
        <div class="token-icon ${tokenIconClass}">${token.symbol.charAt(0)}</div>
        <div class="token-info">
          <div class="token-name">${token.name}</div>
          <div class="token-symbol">${token.symbol}</div>
        </div>
        <button class="add-searched-token-btn">Add</button>
      </div>
    `;
  });
  resultsHtml += '</div>';
  
  container.innerHTML = resultsHtml;
  container.style.display = 'block';
  
  // Add click listeners to the add buttons
  container.querySelectorAll('.add-searched-token-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const tokenItem = e.target.closest('.search-result-item');
      const token = JSON.parse(tokenItem.dataset.token);
      addTokenToPortfolio(token);
    });
  });
}

// Show add token modal
function showAddTokenModal() {
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'addTokenModal';
  modalOverlay.style.display = 'flex';
  
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Custom Token</h3>
        <span class="close-modal" id="closeAddToken">&times;</span>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label for="tokenContract">Token Contract Address</label>
          <input type="text" id="tokenContract" placeholder="0x..." />
        </div>
        <div class="input-group">
          <label for="tokenSymbol">Token Symbol</label>
          <input type="text" id="tokenSymbol" placeholder="e.g. ABC" />
        </div>
        <div class="input-group">
          <label for="tokenDecimals">Decimals</label>
          <input type="number" id="tokenDecimals" placeholder="18" value="18" min="0" max="18"/>
        </div>
        <div class="input-group">
          <label for="tokenName">Token Name</label>
          <input type="text" id="tokenName" placeholder="e.g. ABC Token" />
        </div>
        <button class="action-btn add-custom-token" id="addCustomToken">Add Token</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalOverlay);
  
  // Add event listeners
  document.getElementById('closeAddToken').addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  document.getElementById('addCustomToken').addEventListener('click', addCustomToken);
}

// Add custom token
async function addCustomToken() {
  const contract = document.getElementById('tokenContract').value.trim();
  const symbol = document.getElementById('tokenSymbol').value.trim();
  const decimals = document.getElementById('tokenDecimals').value;
  const name = document.getElementById('tokenName').value.trim();
  
  // Basic validation
  if (!contract || !symbol || !name) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Basic address validation
  if (!contract.startsWith('0x') || contract.length !== 42) {
    alert('Please enter a valid contract address');
    return;
  }
  
  if (isNaN(decimals) || decimals < 0 || decimals > 18) {
    alert('Decimals must be between 0 and 18');
    return;
  }
  
  // Send to background to add to portfolio
  chrome.runtime.sendMessage({
    action: 'addTokenToPortfolio',
    chain: localStorage.getItem('network') || 'ethereum',
    token: {
      contractAddress: contract,
      symbol: symbol.toUpperCase(),
      name: name,
      decimals: parseInt(decimals)
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error adding custom token:', chrome.runtime.lastError);
      alert('Error adding token: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response && response.success) {
      alert(response.message);
      // Close modal
      const modal = document.getElementById('addTokenModal');
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      // Refresh token list
      loadTokenBalances();
    } else {
      alert('Error adding token: ' + response.error);
    }
  });
}

// Add token to portfolio from search
async function addTokenToPortfolio(token) {
  chrome.runtime.sendMessage({
    action: 'addTokenToPortfolio',
    chain: localStorage.getItem('network') || 'ethereum',
    token: token
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error adding token:', chrome.runtime.lastError);
      alert('Error adding token: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (response && response.success) {
      alert(response.message);
      // Hide search results
      document.getElementById('searchResults').style.display = 'none';
      // Refresh token list
      loadTokenBalances();
    } else {
      alert('Error adding token: ' + response.error);
    }
  });
}

// Add message handlers to the main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing handlers ...
  
  if (request.action === 'searchTokens') {
    searchTokens(request.chain, request.query).then(results => {
      sendResponse({ tokens: results });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'addTokenToPortfolio') {
    addTokenToPortfolio(request.chain, request.token).then(response => {
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
  }
});

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