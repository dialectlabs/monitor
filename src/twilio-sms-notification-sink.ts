import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import { Twilio } from 'twilio';

/**
 * Sms notification
 */
export interface SmsNotification extends Notification {
  body: string;
}

export type SmsNumber = string;

export type ResourceSms = {
  resourceId: ResourceId;
  smsNumber: SmsNumber;
};

export interface ResourceSmsNumberRepository {
  findBy(resourceIds: ResourceId[]): Promise<ResourceSms[]>;
}

export class TwilioSmsNotificationSink
  implements NotificationSink<SmsNotification>
{
  private twilio: Twilio;
  constructor(
    private readonly twilioAccount: { username: string, password: string },
    private readonly senderSmsNumber: string,
    private readonly resourceIdToReceiverSmsNumberMapper: ResourceSmsNumberRepository,
  ) {
    this.twilio = new Twilio(twilioAccount.username, twilioAccount.password);
  }

  async push(notification: SmsNotification, recipients: ResourceId[]) {
    const recipientSmSNumbers = await this.resourceIdToReceiverSmsNumberMapper.findBy(
      recipients,
    );
    const results = await Promise.allSettled(recipientSmSNumbers.map(({ smsNumber }) => {
      this.twilio.messages.create({
        to: smsNumber,
        from: this.senderSmsNumber,
        body: notification.body
      }).then(() => {});
    }));
    
    const failedSends = results
      .filter((it) => it.status === 'rejected')
      .map((it) => it as PromiseRejectedResult);
    if (failedSends.length > 0) {
      console.log(
        `Failed to send dialect notification to ${
          failedSends.length
        } recipient(s), reasons: 
        ${failedSends.map((it) => it.reason)}
        `,
      );
    };

    return;
  }
}
