import { NotificationSink, SubscriberRepository } from './ports';
import { Notification, ResourceId } from './data-model';
import { DialectSdk } from '@dialectlabs/sdk';
import { compact } from 'lodash';

export interface DialectNotification extends Notification {
  message: string;
}

export class DialectThreadNotificationSink
  implements NotificationSink<DialectNotification>
{
  constructor(
    private readonly sdk: DialectSdk,
    private readonly subscriberRepository: SubscriberRepository,
  ) {}

  async push({ message }: DialectNotification, recipients: ResourceId[]) {
    const subscribersOnly = await this.subscriberRepository.findAll(recipients);
    const subscribersWithEnabledWalletNotifications = compact(
      subscribersOnly.map((it) => it.wallet),
    );
    const results = await Promise.allSettled(
      subscribersWithEnabledWalletNotifications.map(async (it) => {
        const thread = await this.sdk.threads.find({
          otherMembers: [it],
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
