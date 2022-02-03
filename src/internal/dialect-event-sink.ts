import { Program } from '@project-serum/anchor';
import { Event, EventSink, ResourceId } from '../monitor';
import { Keypair } from '@solana/web3.js';
import { sendMessage } from '@dialectlabs/web3';
import { getDialectAccount } from './dialect-extensions';

export class DialectEventSink implements EventSink {
  constructor(
    private readonly dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {}

  push(event: Event, recipients: ResourceId[]) {
    const notificationText = `${event.message}`;
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
              notificationText,
            ),
          ),
        ),
    ).then(() => {});
  }
}
