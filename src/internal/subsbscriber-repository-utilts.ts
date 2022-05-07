import { SubscriberRepository } from '../ports';
import { Web2SubscriberRepository } from '../web-subscriber.repository';
import _ from 'lodash';

export async function getSubscribers(
  subscriberRepository: SubscriberRepository,
  web2SubscriberRepository: Web2SubscriberRepository,
) {
  const subscribers = await subscriberRepository.findAll();
  const web2Subscribers = (await web2SubscriberRepository.findAll()).map(
    (it) => it.resourceId,
  );
  return _.uniqBy([...subscribers, ...web2Subscribers], (it) => it.toBase58());
}
