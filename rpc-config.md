# RPC Configuration

## Source
This extension uses a combination of sources for RPC endpoint discovery:

1. **Default Fallbacks**: Pre-configured RPC URLs for major networks
2. **Chainlist Integration**: Would fetch from chainlist.org in production
3. **User Preferences**: Custom RPCs can be added by users

## Supported Networks
- Ethereum Mainnet
- Polygon
- Binance Smart Chain (BSC)
- Arbitrum
- Optimism
- Avalanche
- Fantom
- Base

## RPC Health Monitoring
- Tests current RPC every 30 seconds
- Automatic failover to backup RPCs
- Visual indicators for RPC status

## Production Implementation
In a production environment, the RPC fetching would be implemented like this:
```javascript
// Example implementation to fetch from chainlist.org
async function fetchRpcsFromChainlist(chainId) {
  const response = await fetch('https://chainid.network/chains.json');
  const chains = await response.json();
  const chain = chains.find(c => c.chainId == chainId);
  return chain ? chain.rpc : [];
}
```

The extension currently uses fallback/default RPCs for demonstration purposes.