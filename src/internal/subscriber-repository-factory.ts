import {
  DialectSdkMonitorProps,
  GenericMonitorProps,
  MonitorProps,
} from '../monitor-api';
import { InMemorySubscriberRepository } from './in-memory-subscriber.repository';
import { DialectSdkSubscriberRepository } from '../dialect-sdk-subscriber.repository';
import { Duration } from 'luxon';
import { SubscriberRepository } from '../ports';
import { BlockchainSdk } from '@dialectlabs/sdk';

const DEFAULT_SUBSCRIBERS_CACHE_TTL = Duration.fromObject({ minutes: 1 });

export class SubscriberRepositoryFactory {
  constructor(private readonly monitorProps: MonitorProps) {}

  create() {
    if ('sdk' in this.monitorProps) {
      return this.createFromSdk(this.monitorProps);
    } else {
      return this.createFromRepository(this.monitorProps);
    }
  }

  private createFromRepository(
    monitorProps: GenericMonitorProps<BlockchainSdk>,
  ) {
    const { subscriberRepository } = monitorProps;
    return this.decorateWithInmemoryIfNeeded(subscriberRepository);
  }

  private createFromSdk(monitorProps: DialectSdkMonitorProps<BlockchainSdk>) {
    const { sdk, subscriberRepository, subscribersCacheTTL } = monitorProps;
    return subscriberRepository
      ? this.decorateWithInmemoryIfNeeded(subscriberRepository)
      : InMemorySubscriberRepository.decorate(
          new DialectSdkSubscriberRepository(sdk),
          subscribersCacheTTL ?? DEFAULT_SUBSCRIBERS_CACHE_TTL,
        );
  }

  private decorateWithInmemoryIfNeeded(
    subscriberRepository: SubscriberRepository,
  ) {
    return subscriberRepository instanceof InMemorySubscriberRepository
      ? subscriberRepository
      : InMemorySubscriberRepository.decorate(
          subscriberRepository,
          this.monitorProps.subscribersCacheTTL ??
            DEFAULT_SUBSCRIBERS_CACHE_TTL,
        );
  }
}
