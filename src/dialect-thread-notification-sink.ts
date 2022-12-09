import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import { Notification, ResourceId } from './data-model';
import { BlockchainSdk, DialectSdk } from '@dialectlabs/sdk';
import { compact } from 'lodash';
import { NotificationTypeEligibilityPredicate } from './internal/notification-type-eligibility-predicate';

export interface DialectNotification extends Notification {
  message: string;
}

export class DialectThreadNotificationSink
  implements NotificationSink<DialectNotification>
{
  constructor(
    private readonly sdk: DialectSdk<BlockchainSdk>,
    private readonly subscriberRepository: SubscriberRepository,
    private readonly notificationTypeEligibilityPredicate: NotificationTypeEligibilityPredicate,
  ) {}

  async push(
    { message }: DialectNotification,
    recipients: ResourceId[],
    { notificationMetadata }: NotificationSinkMetadata,
  ) {
    const subscribers = await this.subscriberRepository.findAll(recipients);
    const wallets = compact(
      subscribers
        .filter((it) =>
          this.notificationTypeEligibilityPredicate.isEligible(
            it,
            notificationMetadata,
          ),
        )
        .map((it) => it.wallet),
    );
    const results = await Promise.allSettled(
      wallets.map(async (it) => {
        const thread = await this.sdk.threads.find({
          otherMembers: [it.toBase58()],
        });
        if (!thread) {
          throw new Error(
            `Cannot send notification for subscriber ${it}, thread does not exist`,
          );
        }
        return thread.send({ text: message });
      }),
    );
    const failedSends = results
      .filter((it) => it.status === 'rejected')
      .map((it) => it as PromiseRejectedResult);
    if (failedSends.length > 0) {
      console.log(
        `Failed to send dialect notification to ${
          failedSends.length
        } recipients, reasons: 
        ${failedSends.map((it) => it.reason)}
        `,
      );
    }
    return;
  }
}
