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
    private readonly cacheInterval: Duration = Duration.fromObject({
      minutes: 5,
    }),
  ) {}

  static decorate(other: SubscriberRepository) {
    return new InMemorySubscriberRepository(other);
  }

  async findAll(): Promise<Subscriber[]> {
    await this.lazyInit();
    return Array(...this.subscribers.values());
  }

  async findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    await this.lazyInit();
    return Promise.resolve(this.subscribers.get(resourceId.toString()) ?? null);
  }

  private async lazyInit() {
    if (this.isInitialized) {
      return;
    }
    console.log('Subscriber repository initialization started...');
    await this.initialize();
    this.isInitialized = true;
    console.log('Subscriber repository initialization finished');
  }

  async subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
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
    }, this.cacheInterval.toMillis());
    return this.updateSubscribers();
  }

  private async updateSubscribers() {
    const subscribers = await this.delegate.findAll();
    const added = subscribers.filter(
      (it) => !this.subscribers.has(it.resourceId.toBase58()),
    );
    if (added.length > 0) {
      console.log(
        `${added.length} subscribers added: ${JSON.stringify(
          added.slice(0, 3),
        )}...`,
      );
    }
    added.forEach((subscriber) => {
      this.onSubscriberAddedHandlers.forEach((it) => it(subscriber));
      this.subscribers.set(subscriber.toString(), subscriber);
    });
    const removed = Array.from(this.subscribers.values()).filter(
      (s1) => !subscribers.find((s2) => s2.resourceId.equals(s1.resourceId)),
    );
    if (removed.length > 0) {
      console.log(
        `${removed.length} subscribers removed: ${JSON.stringify(
          added.slice(0, 3),
        )}...`,
      );
    }
    removed.forEach((subscriber) => {
      this.onSubscriberRemovedHandlers.forEach((it) => it(subscriber));
      this.subscribers.delete(subscriber.toString());
    });
  }
}
