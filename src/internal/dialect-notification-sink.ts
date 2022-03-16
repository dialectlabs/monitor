import { Program } from '@project-serum/anchor';
import { DialectNotification, ResourceId } from '../data-model';
import { Keypair } from '@solana/web3.js';
import { sendMessage } from '@dialectlabs/web3';
import { getDialectAccount } from './dialect-extensions';
import { NotificationSink } from '../ports';

export class DialectNotificationSink
  implements NotificationSink<DialectNotification>
{
  constructor(
    private readonly dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {}

  push({ message }: DialectNotification, recipients: ResourceId[]) {
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
