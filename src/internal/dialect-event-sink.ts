import { Program } from '@project-serum/anchor';
import { Event, EventSink, ResourceId } from '../monitor-api';
import { Keypair } from '@solana/web3.js';
import { getDialectForMembers, sendMessage } from '@dialectlabs/web3';

export class DialectEventSink implements EventSink {
  constructor(
    private readonly program: Program,
    private readonly monitorKeypair: Keypair,
  ) {}

  push(event: Event, recipients: ResourceId[]) {
    const notificationText = `${event.message}`;
    return Promise.all(
      recipients
        .map(
          (it) =>
            getDialectForMembers(this.program, [
              {
                publicKey: this.monitorKeypair.publicKey,
                scopes: [true, true],
              },
              {
                publicKey: it,
                scopes: [true, true],
              },
            ]), // TODO: add api to get dialect by public keys in protocol
        )
        .map((dialectAccountPromise) =>
          dialectAccountPromise.then((dialectAccount) =>
            sendMessage(
              this.program,
              dialectAccount,
              this.monitorKeypair,
              notificationText,
            ),
          ),
        ),
    ).then(() => {});
  }
}
