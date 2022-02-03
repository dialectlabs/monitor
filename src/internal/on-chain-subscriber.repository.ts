import { Program } from '@project-serum/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  ResourceId,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../monitor';
import {
  DialectAccount,
  DialectCreatedEvent,
  DialectDeletedEvent,
  EventSubscription,
  findDialects,
  subscribeToEvents,
} from '@dialectlabs/web3';
import { getDialectAccount } from './dialect-extensions';

export class OnChainSubscriberRepository implements SubscriberRepository {
  private readonly eventSubscriptions: EventSubscription[] = [];

  constructor(
    private dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {
    this.unsubscribeOnShutDown();
  }

  async findByResourceId(resourceId: ResourceId): Promise<ResourceId | null> {
    try {
      const dialectAccount = await getDialectAccount(this.dialectProgram, [
        this.monitorKeypair.publicKey,
        resourceId,
      ]);
      return this.findSubscriberInDialectAccount(dialectAccount);
    } catch (e) {
      console.error(e);
      return Promise.resolve(null);
    }
  }

  private unsubscribeOnShutDown() {
    process.on('SIGINT', () => {
      console.log(
        `Canceling ${this.eventSubscriptions.length} dialect event subscriptions`,
      );
      Promise.all(this.eventSubscriptions.map(async (it) => it.unsubscribe()));
      console.log(
        `Canceled ${this.eventSubscriptions.length} dialect event subscriptions`,
      );
    });
  }

  async findAll(): Promise<ResourceId[]> {
    const dialectAccounts = await findDialects(this.dialectProgram, {
      userPk: this.monitorKeypair.publicKey,
    });
    console.log(`Found ${dialectAccounts.length} accounts`);
    return dialectAccounts.map((dialectAccount) =>
      this.findSubscriberInDialectAccount(dialectAccount),
    );
  }

  async subscribe(
    onSubscriberAdded: SubscriberEventHandler,
    onSubscriberRemoved: SubscriberEventHandler,
  ) {
    const subscription = subscribeToEvents(
      this.dialectProgram,
      async (event) => {
        if (event.type === 'dialect-created' && this.shouldBeTracked(event)) {
          const subscriberResource = await this.findSubscriberInEvent(event);
          console.log(`Subscriber added  ${subscriberResource}`);
          await onSubscriberAdded(subscriberResource);
        }
        if (event.type === 'dialect-deleted' && this.shouldBeTracked(event)) {
          const subscriberResource = this.findSubscriberResource(event.members);
          console.log(`Subscriber removed  ${subscriberResource}`);
          await onSubscriberRemoved(subscriberResource);
        }
        return Promise.resolve();
      },
    );
    subscription.then((it) => this.eventSubscriptions.push(it));
    return subscription;
  }

  private async findSubscriberInEvent(
    event: DialectCreatedEvent | DialectDeletedEvent,
  ): Promise<ResourceId> {
    const dialectAccount = await getDialectAccount(
      this.dialectProgram,
      event.members,
    );
    return this.findSubscriberInDialectAccount(dialectAccount);
  }

  private findSubscriberInDialectAccount(dialectAccount: DialectAccount) {
    return this.findSubscriberResource(
      dialectAccount.dialect.members.map((it) => it.publicKey),
    );
  }

  private findSubscriberResource(publicKeys: PublicKey[]): ResourceId {
    const subscriberPublicKey = publicKeys.find(
      (it) => !it.equals(this.monitorKeypair.publicKey),
    );
    if (!subscriberPublicKey) {
      throw new Error('Cannot find subscriber member');
    }
    return subscriberPublicKey;
  }

  private shouldBeTracked(event: DialectCreatedEvent | DialectDeletedEvent) {
    return event.members.find((it) => it.equals(this.monitorKeypair.publicKey));
  }
}
