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
  private eventSubscription?: EventSubscription;

  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

  constructor(
    private dialectProgram: Program,
    private readonly monitorKeypair: Keypair,
  ) {}

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

  async tearDown() {
    this.eventSubscription && (await this.eventSubscription.unsubscribe());
  }

  async findAll(): Promise<ResourceId[]> {
    const dialectAccounts = await findDialects(this.dialectProgram, {
      userPk: this.monitorKeypair.publicKey,
    });
    return dialectAccounts.map((dialectAccount) =>
      this.findSubscriberInDialectAccount(dialectAccount),
    );
  }

  async subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    onSubscriberAdded && this.onSubscriberAddedHandlers.push(onSubscriberAdded);
    onSubscriberRemoved &&
      this.onSubscriberRemovedHandlers.push(onSubscriberRemoved);
    if (!this.eventSubscription) {
      this.eventSubscription = await subscribeToEvents(
        this.dialectProgram,
        async (event) => {
          if (event.type === 'dialect-created' && this.shouldBeTracked(event)) {
            const subscriberResource = await this.findSubscriberInEvent(event);
            console.log(`Subscriber added  ${subscriberResource}`);
            this.onSubscriberAddedHandlers.forEach((it) =>
              it(subscriberResource),
            );
          }
          if (event.type === 'dialect-deleted' && this.shouldBeTracked(event)) {
            const subscriberResource = this.findSubscriberResource(
              event.members,
            );
            console.log(`Subscriber removed  ${subscriberResource}`);
            this.onSubscriberRemovedHandlers.forEach((it) =>
              it(subscriberResource),
            );
          }
          return Promise.resolve();
        },
      );
    }
    return;
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
