export function determineExternalContentKind(externalContent: string): string | undefined {
  if (externalContent.startsWith('http')) {
    return 'web'
  }
  if (externalContent.startsWith('isbn:')) {
    return 'isbn'
  }
  if (externalContent.startsWith('isan:')) {
    return 'isan'
  }
  if (externalContent.startsWith('doi:')) {
    return 'doi'
  }
  if (externalContent.startsWith('#')) {
    return '#'
  }
  if (externalContent.startsWith('podcast:guid:')) {
    return 'podcast:guid'
  }
  if (externalContent.startsWith('podcast:item:guid:')) {
    return 'podcast:item:guid'
  }
  if (externalContent.startsWith('podcast:publisher:guid:')) {
    return 'podcast:publisher:guid'
  }
  
  // Handle blockchain transaction format: <blockchain>:[<chainId>:]tx:<txid>
  // Match pattern: blockchain name, optional chain ID, "tx:", transaction ID
  const blockchainTxMatch = externalContent.match(/^([a-z]+):(?:[^:]+:)?tx:[a-f0-9]+$/i)
  if (blockchainTxMatch) {
    const blockchain = blockchainTxMatch[1].toLowerCase()
    return `${blockchain}:tx`
  }
  
  // Handle blockchain address format: <blockchain>:[<chainId>:]address:<address>
  // Match pattern: blockchain name, optional chain ID, "address:", address
  const blockchainAddressMatch = externalContent.match(/^([a-z]+):(?:[^:]+:)?address:[a-zA-Z0-9]+$/i)
  if (blockchainAddressMatch) {
    const blockchain = blockchainAddressMatch[1].toLowerCase()
    return `${blockchain}:address`
  }
}
