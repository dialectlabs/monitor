import { PublicKey } from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { getDialectForMembers } from '@dialectlabs/web3';

// TODO: move to protocol
export function getDialectAccount(
  dialectProgram: Program,
  publicKeys: PublicKey[],
) {
  return getDialectForMembers(
    dialectProgram,
    publicKeys.map((publicKey) => ({
      publicKey,
      scopes: [true, true],
    })),
  );
}
