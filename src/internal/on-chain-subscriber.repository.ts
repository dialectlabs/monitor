import { Program } from '@project-serum/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  ResourceId,
  Subscriber,
  SubscriberAddedEventHandler,
  SubscriberRemovedEventHandler,
  SubscriberRepository,
} from '../monitor-api';
import {
  DialectAccount,
  DialectCreatedEvent,
  DialectDeletedEvent,
  EventSubscription,
  findDialects,
  getDialectForMembers,
  subscribeToEvents,
} from '@dialectlabs/web3';

export class OnChainSubscriberRepository implements SubscriberRepository {
  private readonly eventSubscriptions: EventSubscription[] = [];

  constructor(
    private dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {
    this.unsubscribeOnShutDown();
  }

  async findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    try {
      const dialectAccount = await getDialectForMembers(this.dialectProgram, [
        {
          publicKey: this.monitorKeypair.publicKey,
          scopes: [true, true],
        },
        {
          publicKey: resourceId,
          scopes: [true, true],
        },
      ]); // TODO: add api to get dialect by public keys in protocol
      return this.extractSubscriber(dialectAccount);
    } catch (e) {
      console.error(e);
      return Promise.resolve(null);
    }
  }

  private unsubscribeOnShutDown() {
    process.on('SIGINT', async () => {
      console.log(
        `Canceling ${this.eventSubscriptions.length} dialect event subscriptions`,
      );
      await Promise.all(
        this.eventSubscriptions.map(async (it) => it.unsubscribe()),
      );
      console.log(
        `Canceled ${this.eventSubscriptions.length} dialect event subscriptions`,
      );
    });
  }

  async findAll(): Promise<Subscriber[]> {
    const dialectAccounts = await findDialects(this.dialectProgram, {
      userPk: this.monitorKeypair.publicKey,
    });
    console.log(`Found ${dialectAccounts.length} accounts`);
    return dialectAccounts.map((it) => this.extractSubscriber(it));
  }

  private extractSubscriber(dialectAccount: DialectAccount): Subscriber {
    return {
      resourceId: this.findSubscriberResource(
        dialectAccount.dialect.members.map((it) => it.publicKey),
      ),
      dialectAccount,
    };
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

  async subscribe(
    onSubscriberAdded: SubscriberAddedEventHandler,
    onSubscriberRemoved: SubscriberRemovedEventHandler,
  ) {
    const subscription = subscribeToEvents(
      this.dialectProgram,
      async (event) => {
        if (event.type === 'dialect-created' && this.shouldBeTracked(event)) {
          const subscriber = await this.findSubscriberInEvent(event);
          console.log(`Subscriber added  ${subscriber.resourceId}`);
          await onSubscriberAdded(subscriber);
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
  ): Promise<Subscriber> {
    const dialectAccount = await getDialectForMembers(
      this.dialectProgram,
      event.members.map((publicKey) => ({
        publicKey,
        scopes: [true, true],
      })), // TODO: add api to get dialect by public keys in protocol
    );
    return this.extractSubscriber(dialectAccount);
  }

  private shouldBeTracked(event: DialectCreatedEvent | DialectDeletedEvent) {
    return event.members.find((it) => it.equals(this.monitorKeypair.publicKey));
  }
}
