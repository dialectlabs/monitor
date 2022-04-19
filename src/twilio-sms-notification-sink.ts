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
    return Promise.allSettled(recipientSmSNumbers.map(({ smsNumber }) => {
      this.twilio.messages.create({
        to: smsNumber,
        from: this.senderSmsNumber,
        body: notification.body
      }).then(() => {});
    }));
  }
}
