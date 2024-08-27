import { type Address, type Chain } from 'viem';
import { sepolia } from 'viem/chains';
import { GraphQLClient, gql } from 'graphql-request';

// EAS GraphQL endpoint for Sepolia
const EAS_GRAPHQL_ENDPOINT = 'https://sepolia.easscan.org/graphql';

type EASSchemaUid = string;

type GetAttestationQueryVariablesFilters = {
  expirationTime?: number;
  limit: number;
  revoked: boolean;
  schemas?: EASSchemaUid[];
  attester?: Address;
};

export type GetAttestationsByFilterOptions = GetAttestationQueryVariablesFilters;

type Attestation = {
  id: string;
  attester: string;
  recipient: string;
  refUID: string;
  revocable: boolean;
  revocationTime: number;
  expirationTime: number;
  data: string;
  time: number;
};

const attestationQuery = gql`
  query Attestations($where: AttestationWhereInput, $take: Int) {
    attestations(where: $where, take: $take) {
      id
      attester
      recipient
      refUID
      revocable
      revocationTime
      expirationTime
      data
      time
    }
  }
`;

function createEasGraphQLClient(chain: Chain): GraphQLClient {
  return new GraphQLClient(EAS_GRAPHQL_ENDPOINT);
}

function getAttestationQueryVariables(address: Address, filters: GetAttestationQueryVariablesFilters) {
  const conditions: Record<string, any> = {
    recipient: { equals: address },
    revoked: { equals: filters.revoked },
  };

  if (typeof filters.expirationTime === 'number') {
    conditions.OR = [{ expirationTime: { equals: 0 } }, { expirationTime: { gt: filters.expirationTime } }];
  }

  if (filters?.schemas && filters.schemas.length > 0) {
    conditions.schemaId = { in: filters.schemas };
  }

  if (filters.attester) {
    conditions.attester = { equals: filters.attester };
  }

  return {
    where: conditions,
    take: filters.limit,
  };
}

async function getAttestationsByFilter<TChain extends Chain>(
  address: Address,
  chain: TChain,
  filters: GetAttestationsByFilterOptions,
): Promise<Attestation[]> {
  const easGraphqlClient = createEasGraphQLClient(chain);
  const attestationQueryVariables = getAttestationQueryVariables(address, filters);

  const { attestations } = await easGraphqlClient.request<{ attestations: Attestation[] }>(
    attestationQuery,
    attestationQueryVariables,
  );

  return attestations;
}

export async function getAttestations(
  address: Address,
  chain: Chain,
  options?: Partial<GetAttestationsByFilterOptions>,
): Promise<Attestation[]> {
  try {
    const defaultQueryVariablesFilter: GetAttestationsByFilterOptions = {
      revoked: false,
      expirationTime: Math.round(Date.now() / 1000),
      limit: 10,
    };
    const queryVariablesFilter = { ...defaultQueryVariablesFilter, ...options };
    return await getAttestationsByFilter(address, chain, queryVariablesFilter);
  } catch (error) {
    console.log(`Error in getAttestation: ${(error as Error).message}`);
    return [];
  }
}

// Usage example
async function main() {
  const recipientAddress = '0x6D83cac25CfaCdC7035Bed947B92b64e6a8B8090' as Address;
  const verifierAddress = '0xD892F010cc6B13dF6BBF1f5699bd7cDF1ec23595' as Address;
  const schemaId = '0xb85ca4e8a36a93ab732bca0911a1517967905e8e0ff3267d161bfdf086e9b302';

  const options: Partial<GetAttestationsByFilterOptions> = {
    schemas: [schemaId],
    attester: verifierAddress,
    limit: 10,
  };

  const attestations = await getAttestations(recipientAddress, sepolia, options);

  if (attestations.length > 0) {
    console.log('Attestations found:', attestations);
  } else {
    console.log('No attestations found for the given parameters.');
  }
}

main().catch(console.error);
