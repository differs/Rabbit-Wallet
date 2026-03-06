// Utility functions for Rabbit Wallet

// Import ethers.js library
async function loadEthersLibrary() {
  if (typeof window.ethers !== 'undefined') {
    return window.ethers;
  }
  
  // Dynamically load ethers library if not available
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
    script.onload = () => resolve(window.ethers);
    script.onerror = () => reject(new Error('Failed to load ethers library'));
    document.head.appendChild(script);
  });
}

// Utility to validate Ethereum address
function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false;
  
  // Simple regex check (in a real app, use ethers.utils.isAddress)
  const ethAddrRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddrRegex.test(address);
}

// Utility to convert Ether to Wei
function etherToWei(etherAmount) {
  // Convert ether string to wei (smallest unit)
  // In a real app, use ethers.utils.parseEther(etherAmount)
  return parseFloat(etherAmount) * 1e18;
}

// Utility to convert Wei to Ether
function weiToEther(weiAmount) {
  // Convert wei to ether
  // In a real app, use ethers.utils.formatEther(weiAmount)
  return parseInt(weiAmount) / 1e18;
}

// Export utilities if in module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadEthersLibrary,
    isValidEthereumAddress,
    etherToWei,
    weiToEther
  };
}