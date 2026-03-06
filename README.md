# Rabbit Wallet - Multi-Chain Crypto Wallet Extension

A sophisticated Chrome extension that provides a multi-chain wallet with stats dashboard, DeFi integration, and token management. The wallet intelligently manages RPC endpoints and provides seamless cross-chain experiences.

![Wallet Preview](icons/icon.svg)

## Features

- **Multi-Chain Support**: Connect your wallet across Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Fantom, and Base
- **Automatic RPC Management**: Fetches RPC URLs and handles automatic failover when nodes become unavailable
- **Smart RPC Switching**: Monitors RPC health and automatically switches to available nodes
- **Wallet Connection**: Connect your wallet directly from the sidebar with simulated connection
- **Statistics Dashboard**: View interception statistics, saved data, and time saved
- **Multi-Tab Interface**: Navigate between STATS, REWARDS, TOKENS, DEFI, NFTS, and ACTIVITY
- **Token Management**: View and manage your cryptocurrency tokens
- **DeFi Integration**: Access staking pools and yield farming opportunities
- **RPC Health Monitoring**: Automatically detects and switches to healthy RPC endpoints
- **Dark Theme**: Modern dark UI with glassmorphism effects

## Installation

### Prerequisites
- Google Chrome or Chromium-based browser (version 117+)
- Enabled Developer Mode in Chrome Extensions

### Manual Installation

1. Clone or download this repository
   ```bash
   git clone git@github.com:differs/Rabbit-Wallet.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the Rabbit-Wallet folder

5. The extension should now appear in your extensions list

6. Pin the extension to your toolbar for easy access

### Using the Extension

1. Click the Rabbit Wallet icon in your toolbar
2. Select "Open in sidebar" or click the extension icon again
3. Choose your preferred network from the dropdown
4. Click "Connect" to connect your wallet (simulated for this demo)
5. Explore the various tabs and features

## Development

This extension uses Chrome Extension Manifest V3 and the Side Panel API. Key features:

- Uses `chrome.sidePanel` API for the sidebar interface
- Implements simulated wallet functionality (in a real implementation, this would connect to MetaMask or other wallets)
- Includes mock data for stats display
- Responsive design that works well in a narrow sidebar
- Dark theme with glassmorphism effects
- Multi-chain support with automatic RPC failover
- Real-time RPC health monitoring

### File Structure

```
Rabbit-Wallet/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker with multi-chain and RPC management
├── sidebar.html           # Main sidebar interface
├── sidebar.css            # Styling for the sidebar with dark theme
├── sidebar.js             # Sidebar functionality with multi-chain support
├── content.js             # Content script for web interaction
├── content.css            # Content styling
├── rpc-config.md          # Documentation of RPC configuration
├── icons/                 # Extension icons
├── .gitignore             # Git ignore file
└── README.md              # This file
```

## Configuration

The extension is configured with multiple blockchain networks that can be accessed through the network selector:

- Ethereum Mainnet
- Polygon
- Binance Smart Chain (BSC)
- Arbitrum
- Optimism
- Avalanche
- Fantom
- Base

Each network has multiple RPC endpoints configured with automatic failover capabilities.

## API and Permissions

The extension requires the following permissions:
- `sidePanel` - To open the sidebar interface
- `activeTab` - To interact with the currently active tab
- `storage` - To store wallet and preference data
- Host permissions for web3 APIs (Infura, Alchemy, Etherscan)

## RPC Management

The extension implements intelligent RPC management:

- Fetches multiple RPC URLs for each chain
- Monitors RPC health every 30 seconds
- Automatically switches to backup RPCs when primary fails
- Implements timeout protection to avoid hanging requests

## Building and Testing

To test the extension:

1. Install as described above
2. Open a new tab to trigger the sidebar
3. Test wallet connection functionality
4. Switch between different networks
5. Verify that stats update periodically
6. Observe RPC switching in action (requires network stress testing)

## Security Notes

- The current implementation uses simulated wallet connections
- In a production environment, proper wallet connection (like MetaMask) should be implemented
- All sensitive operations should be properly validated and secured
- Never store private keys in the extension
- RPC endpoints are monitored and switched automatically for reliability

## Browser Compatibility

- Chrome 117+
- Edge (Chromium-based)
- The extension uses the Side Panel API which requires Chrome 114+

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For support, please open an issue in the GitHub repository.

### Manual Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now appear in your extensions list
6. Pin the extension to your toolbar for easy access

### Using the Extension

1. Click the extension icon in your toolbar
2. Select "Open in sidebar" or click the extension icon again
3. Click "Connect" to connect your wallet (uses simulated connection in this demo)
4. Explore the various tabs and features

## Files Structure

```
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── sidebar.html           # Main sidebar interface
├── sidebar.css            # Styling for the sidebar
├── sidebar.js             # Sidebar functionality
├── content.js             # Content script for web interaction
├── content.css            # Content styling (if needed)
├── icons/                 # Extension icons
└── README.md              # This file
```

## Development

This extension uses Chrome Extension Manifest V3 and the Side Panel API. Key features:

- Uses `chrome.sidePanel` API for the sidebar interface
- Implements simulated wallet functionality (in a real implementation, this would connect to MetaMask or other wallets)
- Includes mock data for stats display
- Responsive design that works well in a narrow sidebar
- Dark theme with glassmorphism effects

## Permissions

The extension requires the following permissions:
- `sidePanel` - To open the sidebar interface
- `activeTab` - To interact with the currently active tab
- `storage` - To store wallet and preference data
- Host permissions for web3 APIs (Infura, Alchemy, Etherscan)

## Testing

To test the extension:
1. Install as described above
2. Open a new tab to trigger the sidebar
3. Test wallet connection functionality
4. Navigate through different tabs
5. Verify that stats update periodically

## Security Notes

- The current implementation uses simulated wallet connections
- In a production environment, proper wallet connection (like MetaMask) should be implemented
- All sensitive operations should be properly validated and secured
- Never store private keys in the extension

## Browser Compatibility

- Chrome 117+
- Edge (Chromium-based)
- The extension uses the Side Panel API which requires Chrome 114+

## License

This project is open source and available under the MIT License.