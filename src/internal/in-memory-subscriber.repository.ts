import { ResourceId } from '../data-model';
import {
  Subscriber,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../ports';
import { Duration } from 'luxon';

export class InMemorySubscriberRepository implements SubscriberRepository {
  private readonly subscribers: Map<String, Subscriber> = new Map<
    String,
    Subscriber
  >();

  private readonly onSubscriberAddedHandlers: SubscriberEventHandler[] = [];
  private readonly onSubscriberRemovedHandlers: SubscriberEventHandler[] = [];

  private isInitialized = false;

  constructor(
    private readonly delegate: SubscriberRepository,
    private readonly cacheTtl: Duration,
  ) {}

  static decorate(
    other: SubscriberRepository,
    cacheTtl: Duration = Duration.fromObject({
      minutes: 1,
    }),
  ) {
    return new InMemorySubscriberRepository(other, cacheTtl);
  }

  async findAll(resourceIds?: ResourceId[]): Promise<Subscriber[]> {
    await this.lazyInit();
    const subscribers = Array(...this.subscribers.values());
    return resourceIds
      ? subscribers.filter(({ resourceId }) =>
          resourceIds.find((it) => it.equals(resourceId)),
        )
      : subscribers;
  }

  async findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    await this.lazyInit();
    return Promise.resolve(this.subscribers.get(resourceId.toString()) ?? null);
  }

  private async lazyInit() {
    if (this.isInitialized) {
      return;
    }
    await this.initialize();
    this.isInitialized = true;
  }

  async subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    await this.lazyInit();
    onSubscriberAdded && this.onSubscriberAddedHandlers.push(onSubscriberAdded);
    onSubscriberRemoved &&
      this.onSubscriberRemovedHandlers.push(onSubscriberRemoved);
  }

  private async initialize() {
    setInterval(async () => {
      try {
        await this.updateSubscribers();
      } catch (e) {
        console.error('Updating subscribers failed.', e);
      }
    }, this.cacheTtl.toMillis());
    return this.updateSubscribers();
  }

  private async updateSubscribers() {
    const subscribers = await this.delegate.findAll();
    const added = subscribers.filter(
      (it) => !this.subscribers.has(it.resourceId.toBase58()),
    );
    if (added.length > 0) {
      console.log(
        `${added.length} subscriber(s) added: ${JSON.stringify(
          added.slice(0, 3),
        )}`,
      );
    }
    added.forEach((subscriber) => {
      this.onSubscriberAddedHandlers.forEach((it) => it(subscriber));
      this.subscribers.set(subscriber.resourceId.toBase58(), subscriber);
    });
    const removed = Array.from(this.subscribers.values()).filter(
      (s1) => !subscribers.find((s2) => s2.resourceId.equals(s1.resourceId)),
    );
    if (removed.length > 0) {
      console.log(
        `${removed.length} subscriber(s) removed: ${JSON.stringify(
          removed.slice(0, 3),
        )}...`,
      );
    }
    removed.forEach((subscriber) => {
      this.onSubscriberRemovedHandlers.forEach((it) => it(subscriber));
      this.subscribers.delete(subscriber.resourceId.toBase58());
    });
  }
}
