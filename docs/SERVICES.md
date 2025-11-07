# Services Reference

Complete API documentation for all services in nestjs-solana-kit.

> **SDK Version:** This documentation applies to nestjs-solana-kit using `@solana/kit` v5.x
>
> **Compatibility:** NestJS v10+ and v11+, Node.js 18+, 20+, 24+

## Configuration Options

```typescript
interface SolanaModuleOptions {
  /**
   * The RPC URL for connecting to Solana
   * @example 'https://api.mainnet-beta.solana.com'
   */
  rpcUrl: string;

  /**
   * The Solana cluster to connect to
   * @default 'mainnet-beta'
   */
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';

  /**
   * The commitment level for queries
   * @default 'confirmed'
   */
  commitment?: 'processed' | 'confirmed' | 'finalized';

  /**
   * WebSocket URL for subscriptions (optional)
   * @example 'wss://api.mainnet-beta.solana.com'
   */
  wsUrl?: string;

  /**
   * Enable request retry logic
   * @default true
   */
  retryEnabled?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Timeout for RPC requests in milliseconds
   * @default 30000
   */
  timeout?: number;
}
```

## SolanaRpcService

Core RPC client management and health checks.

**Methods:**
- `getRpc()`: Get the Solana RPC instance
- `getCluster()`: Get the current cluster
- `getOptions()`: Get the module options
- `isHealthy()`: Check if the connection is healthy

## SolanaConfigService

Centralized configuration management with getter-based API.

**Getters:**
- `clusterName`: Get the cluster ('devnet' | 'testnet' | 'mainnet-beta' | 'localnet')
- `rpcUrl`: Get the RPC URL
- `wsUrl`: Get the WebSocket URL (if configured)
- `commitment`: Get the commitment level ('processed' | 'confirmed' | 'finalized')
- `options`: Get the complete SolanaModuleOptions object

## SolanaAccountService

Account queries and balance checks.

**Methods:**
- `getBalance(address)`: Get SOL balance in lamports
  - Returns: `bigint`
- `getBalanceInSol(address)`: Get SOL balance in SOL
  - Returns: `number`
- `getAccountInfo(address)`: Get account information
  - Returns: `AccountInfo | null`
- `getMultipleAccounts(addresses)`: Get multiple accounts in one call
  - Returns: `(AccountInfo | null)[]`
- `getTokenAccounts(owner, mint?)`: Get token accounts
  - Returns: `TokenAccount[]`
- `accountExists(address)`: Check if account exists
  - Returns: `boolean`
- `getMinimumBalanceForRentExemption(dataLength)`: Get minimum balance for rent exemption
  - Returns: `bigint`

## SolanaBlockService

Block and epoch information queries.

**Methods:**
- `getCurrentSlot()`: Get the current slot
  - Returns: `bigint`
- `getBlockHeight()`: Get the current block height
  - Returns: `bigint`
- `getBlock(slot, includeTransactions?)`: Get block by slot
  - Returns: `BlockInfo | BlockInfoWithTransactions | null`
- `getLatestBlockhash()`: Get latest blockhash
  - Returns: `{ blockhash: string, lastValidBlockHeight: number }`
- `isBlockhashValid(blockhash)`: Check if blockhash is valid
  - Returns: `boolean`
- `getBlockTime(slot)`: Get block production time
  - Returns: `number | null`
- `getBlocks(startSlot, endSlot?)`: Get range of blocks
  - Returns: `bigint[]`
- `getBlocksWithLimit(startSlot, limit)`: Get blocks with limit
  - Returns: `bigint[]`
- `getSlotLeader()`: Get current slot leader
  - Returns: `string`
- `getEpochInfo()`: Get epoch information
  - Returns: `EpochInfo`

## SolanaTransactionService

Transaction building, sending, and confirmation.

**Transaction Building:**
- `buildTransactionMessage(args)`: Build transaction with auto-fetched blockhash
  - Args: `{ instructions: Instruction[], feePayer: Address }`
  - Returns: `TransactionMessage`
- `buildTransactionMessageWithBlockhash(args)`: Build transaction with explicit blockhash
  - Args: `{ instructions: Instruction[], feePayer: Address, blockhash: Blockhash, lastValidBlockHeight: number }`
  - Returns: `TransactionMessage`
- `signTransactionMessage(message, signers)`: Sign a transaction message
  - Returns: `SignedTransaction`

**Transaction Sending:**
- `sendTransaction(signedTx, options?)`: Send transaction without waiting for confirmation
  - Returns: `string` (signature)
- `sendAndConfirm(signedTx, options?, maxAttempts?)`: Send transaction and wait for confirmation
  - Returns: `{ signature: string, confirmed: boolean, slot?: number }`
  - Recommended for most use cases
  - Default: 30 attempts (~30 seconds timeout)
- `sendEncoded(encodedTx, options?)`: Send encoded transaction without waiting
  - Returns: `string` (signature)

**Confirmation Waiting:**
- `waitForConfirmation(signature, lastValidBlockHeight?, maxAttempts?)`: Wait for confirmation
  - With `lastValidBlockHeight`: Block height + attempt-based timeout
  - Without `lastValidBlockHeight`: Attempt-based timeout only
  - Returns: `{ confirmed: boolean, slot?: number }`

**Transaction Queries:**
- `getTransaction(signature)`: Get transaction details
  - Returns: `Transaction | null`
- `getTransactionStatus(signature)`: Get transaction status
  - Returns: `SignatureStatus | null`
- `getSignaturesForAddress(address, limit?)`: Get signatures for address
  - Returns: `ConfirmedSignatureInfo[]`
- `simulateTransaction(encodedTx)`: Simulate transaction before sending
  - Returns: `SimulationResult`
- `getSignature(tx)`: Extract signature from signed transaction
  - Returns: `string`
- `encodeTransaction(tx)`: Encode signed transaction to base64
  - Returns: `string`

## SolanaSubscriptionService

WebSocket subscriptions for real-time updates.

**Methods:**
- `onAccountChange(address, callback)`: Subscribe to account changes
  - Callback: `(notification: AccountNotification) => void`
  - Returns: `number` (subscription ID)
- `onSlotChange(callback)`: Subscribe to slot changes
  - Callback: `(slot: { parent: number, root: number, slot: number }) => void`
  - Returns: `number`
- `onSignature(signature, callback)`: Subscribe to signature notifications
  - Callback: `(notification: SignatureNotification) => void`
  - Returns: `number`
- `onProgramAccountChange(programId, callback)`: Subscribe to program account changes
  - Callback: `(notification: ProgramAccountNotification) => void`
  - Returns: `number`
- `onLogs(address, callback)`: Subscribe to logs
  - Callback: `(notification: LogsNotification) => void`
  - Returns: `number`
- `unsubscribe(id)`: Unsubscribe from a subscription
- `unsubscribeAll()`: Unsubscribe from all subscriptions
- `getActiveSubscriptionCount()`: Get number of active subscriptions
  - Returns: `number`

## SolanaUtilsService

Compatibility layer between @solana/web3.js v1.x and @solana/kit v4.x.

**Transaction Building:**
- `buildTransaction(args: BuildTransactionArgs)`: Build unsigned transaction with automatic blockhash fetching
  - Args: `{ instructions: Instruction[], feePayer: Address }`
  - Returns: `TransactionMessage`
- `buildTransactionWithBlockhash(args: BuildTransactionWithBlockhashArgs)`: Build unsigned transaction with explicit blockhash
  - Args: `{ instructions: Instruction[], feePayer: Address, blockhash: Blockhash, lastValidBlockHeight: number }`
  - Returns: `TransactionMessage`
- `signTransaction(transactionMessage, signers)`: Sign a transaction message
  - Returns: `SignedTransaction`
- `getSignature(signedTransaction)`: Extract signature from a signed transaction
  - Returns: `string`
- `encodeTransaction(signedTransaction)`: Encode signed transaction to base64
  - Returns: `string`

**Address Conversion:**
- `toAddress(input: PublicKey | Address | string)`: Convert to kit Address
  - Returns: `Address`
- `toPublicKey(addr: Address | string)`: Convert to legacy PublicKey
  - Returns: `PublicKey`

**Signer/Keypair Conversion:**
- `keypairToSigner(keypair: Keypair)`: Convert legacy Keypair to kit TransactionSigner
  - Returns: `TransactionSigner`
- `signerFromSecretKey(secretKey: Uint8Array)`: Create kit TransactionSigner from secret key bytes
  - Returns: `Promise<TransactionSigner>`
- `signerToKeypair(signer: TransactionSigner)`: Convert kit TransactionSigner back to legacy Keypair
  - Returns: `Keypair`

**Instruction Conversion:**
- `instructionToKit(legacyInstruction: TransactionInstruction)`: Convert to kit Instruction
  - Returns: `Instruction`
- `instructionsToKit(legacyInstructions: TransactionInstruction[])`: Convert array of legacy instructions
  - Returns: `Instruction[]`
- `instructionToLegacy(instruction: Instruction)`: Convert to legacy TransactionInstruction
  - Returns: `TransactionInstruction`
- `instructionsToLegacy(instructions: Instruction[])`: Convert array of kit instructions
  - Returns: `TransactionInstruction[]`

**Account Role Conversion:**
- `legacyFlagsToRole(isSigner: boolean, isWritable: boolean)`: Convert legacy flags to kit AccountRole
  - Returns: `number`
- `roleToLegacyFlags(role: number)`: Convert kit AccountRole to legacy flags
  - Returns: `{ isSigner: boolean, isWritable: boolean }`

**Amount Conversion:**
- `lamportsToSol(lamports: bigint | number)`: Convert lamports to SOL
  - Returns: `number`
- `solToLamports(sol: number)`: Convert SOL to lamports
  - Returns: `bigint`

## SolanaProgramService

Program queries and interactions.

**Methods:**
- `getProgramInfo(programId)`: Get program account information
  - Returns: `AccountInfo | null`
- `isProgramDeployed(programId)`: Check if program exists and is executable
  - Returns: `boolean`
- `getProgramAccounts(programId, filters?)`: Get all accounts owned by a program
  - Returns: `ProgramAccount[]`
- `getProgramDataSize(programId)`: Get program data size in bytes
  - Returns: `number`
- `getProgramOwner(programId)`: Get program owner/upgrade authority
  - Returns: `Address`
