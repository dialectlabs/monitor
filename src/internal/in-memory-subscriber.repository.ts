import {
  ResourceId,
  Subscriber,
  SubscriberAddedEventHandler,
  SubscriberRemovedEventHandler,
  SubscriberRepository,
} from '../monitor-api';

export class InMemorySubscriberRepository implements SubscriberRepository {
  private readonly subscribers: Map<String, Subscriber> = new Map<
    String,
    Subscriber
  >();

  constructor(private readonly delegate: SubscriberRepository) {}

  static decorate(other: SubscriberRepository) {
    const repository = new InMemorySubscriberRepository(other);
    repository.initialize();
    return repository;
  }

  private async initialize() {
    return Promise.all([
      this.subscribeToSubscriberEvents(),
      this.updateSubscribers(),
    ]);
  }

  private async subscribeToSubscriberEvents() {
    this.delegate.subscribe(
      (subscriber) =>
        this.subscribers.set(subscriber.resourceId.toString(), subscriber),
      (resourceId) => this.subscribers.delete(resourceId.toString()),
    );
  }

  private async updateSubscribers() {
    const subscribers = await this.loadSubscribers();
    subscribers.forEach((it) =>
      this.subscribers.set(it.resourceId.toString(), it),
    );
  }

  private async loadSubscribers() {
    const subscribers = await this.delegate.findAll();
    subscribers.forEach((it) =>
      this.subscribers.set(it.resourceId.toString(), it),
    );
    return subscribers;
  }

  async findAll(): Promise<Subscriber[]> {
    return Array(...this.subscribers.values());
  }

  findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    return Promise.resolve(this.subscribers.get(resourceId.toString()) ?? null);
  }

  async subscribe(
    onSubscriberAdded: SubscriberAddedEventHandler,
    onSubscriberRemoved: SubscriberRemovedEventHandler,
  ) {
    return this.delegate.subscribe(onSubscriberAdded, onSubscriberRemoved);
  }
}
