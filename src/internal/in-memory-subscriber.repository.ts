import { ResourceId } from '../data-model';
import { SubscriberEventHandler, SubscriberRepository } from '../ports';
import { Duration } from 'luxon';

export class InMemorySubscriberRepository implements SubscriberRepository {
  private readonly subscribers: Map<String, ResourceId> = new Map<
    String,
    ResourceId
  >();

  private isInitialized = false;

  constructor(private readonly delegate: SubscriberRepository) {}

  static decorate(other: SubscriberRepository) {
    return new InMemorySubscriberRepository(other);
  }

  async findAll(): Promise<ResourceId[]> {
    await this.lazyInit();
    return Array(...this.subscribers.values());
  }

  async findByResourceId(resourceId: ResourceId): Promise<ResourceId | null> {
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
    return this.delegate.subscribe(onSubscriberAdded, onSubscriberRemoved);
  }

  private async initialize() {
    setInterval(async () => {
      try {
        await this.updateSubscribers();
      } catch (e) {
        console.log('Updating subscribers failed.', e);
      }
    }, Duration.fromObject({ minutes: 5 }).toMillis());
    return Promise.all([
      this.subscribeToSubscriberEvents(),
      this.updateSubscribers(),
    ]);
  }

  private async subscribeToSubscriberEvents() {
    this.delegate.subscribe(
      (subscriber) => this.subscribers.set(subscriber.toString(), subscriber),
      (resourceId) => this.subscribers.delete(resourceId.toString()),
    );
  }

  private async updateSubscribers() {
    const subscribers = await this.delegate.findAll();
    const added = subscribers.filter(
      (it) => !this.subscribers.has(it.toBase58()),
    );
    if (added.length > 0) {
      console.log(`Subscribers added: ${JSON.stringify(added)}`);
    }
    added.forEach((subscriber) =>
      this.subscribers.set(subscriber.toString(), subscriber),
    );
    const removed = Array.from(this.subscribers.values()).filter(
      (s1) => !subscribers.find((s2) => s2.equals(s1)),
    );
    if (removed.length > 0) {
      console.log(`Subscribers removed: ${JSON.stringify(removed)}`);
    }
    removed.forEach((subscriber) =>
      this.subscribers.delete(subscriber.toString()),
    );
  }
}
