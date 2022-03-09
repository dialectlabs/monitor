import { Program } from '@project-serum/anchor';
import { Notification, ResourceId } from '../data-model';
import { Keypair } from '@solana/web3.js';
import { sendMessage } from '@dialectlabs/web3';
import { getDialectAccount } from './dialect-extensions';
import { DataSink } from '../ports';

export class DialectDataSink implements DataSink<Notification> {
  constructor(
    private readonly dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {}

  push({ message }: Notification, recipients: ResourceId[]) {
    return Promise.all(
      recipients
        .map((it) =>
          getDialectAccount(this.dialectProgram, [
            this.monitorKeypair.publicKey,
            it,
          ]),
        )
        .map((dialectAccountPromise) =>
          dialectAccountPromise.then((dialectAccount) =>
            sendMessage(
              this.dialectProgram,
              dialectAccount,
              this.monitorKeypair,
              message,
            ),
          ),
        ),
    ).then(() => {});
  }
}
