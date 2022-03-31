import { NotificationSink } from './ports';
import { getDialectAccount } from './internal/dialect-extensions';
import { Notification, ResourceId } from './data-model';
import { Program } from '@project-serum/anchor';
import { Keypair } from '@solana/web3.js';
import { sendMessage } from '@dialectlabs/web3';

/**
 * Dialect web3 notification
 */
export interface DialectNotification extends Notification {
  message: string;
}

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
