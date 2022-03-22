import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';

/**
 * Email notification
 */
export interface EmailNotification extends Notification {
  subject: string;
  text: string;
}

export type Email = string;

export type ResourceEmail = {
  resourceId: ResourceId;
  email: Email;
};

export interface ResourceEmailRepository {
  findBy(resourceIds: ResourceId[]): Promise<ResourceEmail[]>;
}

export class SengridEmailNotificationSink
  implements NotificationSink<EmailNotification>
{
  constructor(
    private readonly sengridApiKey: string,
    private readonly senderEmail: string,
    private readonly resourceIdToReceiverEmailMapper: ResourceEmailRepository,
  ) {
    sgMail.setApiKey(sengridApiKey);
  }

  async push(notification: EmailNotification, recipients: ResourceId[]) {
    const recipientEmails = await this.resourceIdToReceiverEmailMapper.findBy(
      recipients,
    );
    const emails: MailDataRequired[] = recipientEmails.map(({ email }) => ({
      ...notification,
      from: this.senderEmail,
      to: email,
    }));
    return sgMail.send(emails).then(() => {});
  }
}
