import { createPublicClient, http, createWalletClient, parseAbi, encodeFunctionData } from 'viem';

import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL;

if (!privateKey) {
  throw new Error('PRIVATE_KEY environment variable is not set');
}

if (!rpcUrl) {
  throw new Error('SEPOLIA_RPC_URL environment variable is not set');
}

// SchemaRegistry contract address on Sepolia
const SCHEMA_REGISTRY_ADDRESS = '0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0';

// ABI for the register function
const abi = parseAbi([
  'function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)',
]);

async function createSchema() {
  // Create a public client for the Sepolia network using the provided RPC URL
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  // Create a wallet client using the private key
  const account = privateKeyToAccount(`0x${privateKey}`);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  // Define the schema
  const schema = 'address subject,uint256 credId,bytes32 data';
  const resolverAddress = '0x0000000000000000000000000000000000000000'; // No resolver
  const revocable = true; // Make attestations revocable

  try {
    console.log('Creating schema...');
    console.log('Schema:', schema);
    console.log('Resolver:', resolverAddress);
    console.log('Revocable:', revocable);

    // Encode the function call
    const data = encodeFunctionData({
      abi,
      functionName: 'register',
      args: [schema, resolverAddress, revocable],
    });

    console.log('Encoded data:', data);

    const { request } = await publicClient.simulateContract({
      account,
      address: SCHEMA_REGISTRY_ADDRESS,
      abi,
      functionName: 'register',
      args: [schema, resolverAddress, revocable],
    });
    console.log('Simulation result:', request);

    // Send the transaction
    const hash = await walletClient.sendTransaction({
      to: SCHEMA_REGISTRY_ADDRESS,
      data,
    });

    console.log('Transaction hash:', hash);

    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('Schema registered successfully!');
    console.log('Transaction receipt:', receipt);
    console.log('Schema UID:', receipt.logs[0].topics[1]);
  } catch (error) {
    console.error('Error registering schema:', error);
  }
}

createSchema();
