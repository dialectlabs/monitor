import { ResourceId } from './data-model';

export type Email = string;

export interface Web2Subscriber {
  resourceId: ResourceId;
  email?: Email;
  telegramChatId?: string;
  smsNumber?: string;
}

export interface Web2SubscriberRepository {
  findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]>;

  findAll(): Promise<Web2Subscriber[]>;
}

export class NoopWeb2SubscriberRepository implements Web2SubscriberRepository {
  findBy(resourceIds: ResourceId[]): Promise<Web2Subscriber[]> {
    return Promise.resolve([]);
  }

  findAll(): Promise<Web2Subscriber[]> {
    return Promise.resolve([]);
  }
}
