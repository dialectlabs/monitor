import { Notification, ResourceId } from './data-model';
import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import { Twilio } from 'twilio';
import { NotificationTypeEligibilityPredicate } from './internal/notification-type-eligibility-predicate';

/**
 * Sms notification
 */
export interface SmsNotification extends Notification {
  body: string;
}

export class TwilioSmsNotificationSink
  implements NotificationSink<SmsNotification>
{
  private twilio: Twilio;

  constructor(
    private readonly twilioAccount: { username: string; password: string },
    private readonly senderSmsNumber: string,
    private readonly subscriberRepository: SubscriberRepository,
    private readonly notificationTypeEligibilityPredicate: NotificationTypeEligibilityPredicate,
  ) {
    this.twilio = new Twilio(twilioAccount.username, twilioAccount.password);
  }

  async push(
    notification: SmsNotification,
    recipients: ResourceId[],
    { notificationMetadata }: NotificationSinkMetadata,
  ) {
    const recipientSmSNumbers = await this.subscriberRepository.findAll(
      recipients,
    );
    console.log('sms-notif-sink, recipients:\n');
    console.log(recipientSmSNumbers);
    const results = await Promise.allSettled(
      recipientSmSNumbers
        .filter(({ phoneNumber }) => phoneNumber)
        .filter((it) =>
          this.notificationTypeEligibilityPredicate.isEligible(
            it,
            notificationMetadata,
          ),
        )
        .map(({ phoneNumber }) => {
          this.twilio.messages
            .create({
              to: phoneNumber!,
              from: this.senderSmsNumber,
              body: notification.body,
            })
            .then(() => {});
        }),
    );

    const failedSends = results
      .filter((it) => it.status === 'rejected')
      .map((it) => it as PromiseRejectedResult);
    if (failedSends.length > 0) {
      console.log(
        `Failed to send dialect SMS notification to ${
          failedSends.length
        } recipient(s), reasons: 
        ${failedSends.map((it) => it.reason)}
        `,
      );
    }
    return;
  }
}
