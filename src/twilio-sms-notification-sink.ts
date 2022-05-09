import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import { Twilio } from 'twilio';
import { Web2SubscriberRepository } from './web-subscriber.repository';

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
    private readonly web2SubscriberRepository: Web2SubscriberRepository,
  ) {
    this.twilio = new Twilio(twilioAccount.username, twilioAccount.password);
  }

  async push(notification: SmsNotification, recipients: ResourceId[]) {
    const recipientSmSNumbers = await this.web2SubscriberRepository.findBy(
      recipients,
    );
    console.log('sms-notif-sink, recipients:\n');
    console.log(recipientSmSNumbers);
    const results = await Promise.allSettled(
      recipientSmSNumbers
        .filter(({ smsNumber }) => smsNumber)
        .map(({ smsNumber }) => {
          this.twilio.messages
            .create({
              to: smsNumber!,
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
