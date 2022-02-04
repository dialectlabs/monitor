import {
  ResourceId,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../monitor';

export class InMemorySubscriberRepository implements SubscriberRepository {
  private readonly subscribers: Map<String, ResourceId> = new Map<
    String,
    ResourceId
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
      (subscriber) => this.subscribers.set(subscriber.toString(), subscriber),
      (resourceId) => this.subscribers.delete(resourceId.toString()),
    );
  }

  private async updateSubscribers() {
    const subscribers = await this.loadSubscribers();
    subscribers.forEach((it) => this.subscribers.set(it.toString(), it));
  }

  private async loadSubscribers() {
    const subscribers = await this.delegate.findAll();
    subscribers.forEach((it) => this.subscribers.set(it.toString(), it));
    return subscribers;
  }

  async findAll(): Promise<ResourceId[]> {
    return Array(...this.subscribers.values());
  }

  findByResourceId(resourceId: ResourceId): Promise<ResourceId | null> {
    return Promise.resolve(this.subscribers.get(resourceId.toString()) ?? null);
  }

  async subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    return this.delegate.subscribe(onSubscriberAdded, onSubscriberRemoved);
  }
}
