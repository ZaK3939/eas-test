import {
  createPublicClient,
  http,
  createWalletClient,
  parseAbi,
  encodeFunctionData,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// EAS contract address on Sepolia
const EAS_CONTRACT_ADDRESS = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e';

// ABI for the attest function
const abi = parseAbi([
  'function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) external payable returns (bytes32)',
]);

async function createAttestation(
  subjectAddress: Address,
  credId: number,
  data: Hex,
  schemaUID: Hex,
): Promise<Hash | null> {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is not set');
  }

  if (!rpcUrl) {
    throw new Error('SEPOLIA_RPC_URL environment variable is not set');
  }

  // Create a public client for the Sepolia network
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

  // Encode the attestation data
  const encodedData = encodeFunctionData({
    abi,
    functionName: 'attest',
    args: [
      {
        schema: schemaUID,
        data: {
          recipient: subjectAddress,
          expirationTime: BigInt(0), // No expiration
          revocable: true,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000', // No reference UID
          data: encodeFunctionData({
            abi: parseAbi(['function encodeData(address subject, uint256 credId, bytes32 data)']),
            functionName: 'encodeData',
            args: [subjectAddress, BigInt(credId), data],
          }),
          value: BigInt(0), // No ETH value sent
        },
      },
    ],
  });

  try {
    // Send the transaction
    const hash = await walletClient.sendTransaction({
      to: EAS_CONTRACT_ADDRESS,
      data: encodedData,
    });

    console.log('Transaction hash:', hash);

    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('Attestation created successfully!');
    console.log('Transaction receipt:', receipt);

    return hash;
  } catch (error) {
    console.error('Error creating attestation:', error);
    return null;
  }
}

// Usage example
const subjectAddress = '0x6D83cac25CfaCdC7035Bed947B92b64e6a8B8090' as Address; // Subject address
const credId = 1;
const data = '0x0000000000000000000000000000000000000000000000000000000000000000'; // Example additional data
const schemaUID = '0xb85ca4e8a36a93ab732bca0911a1517967905e8e0ff3267d161bfdf086e9b302'; // Actual schema UID

createAttestation(subjectAddress, credId, data, schemaUID);
