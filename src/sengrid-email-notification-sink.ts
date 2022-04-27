import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { PublicKey } from '@solana/web3.js';
import { Promise } from 'es6-promise';
import { Web2SubscriberRepository } from './web-subscriber.repository';

/**
 * Email notification
 */
export interface EmailNotification extends Notification {
  subject: string;
  text: string;
}

export class SengridEmailNotificationSink
  implements NotificationSink<EmailNotification>
{
  constructor(
    private readonly sengridApiKey: string,
    private readonly senderEmail: string,
    private readonly web2SubscriberRepository: Web2SubscriberRepository,
  ) {
    sgMail.setApiKey(sengridApiKey);
  }

  async push(notification: EmailNotification, recipients: ResourceId[]) {
    const recipientEmails = await this.web2SubscriberRepository.findBy(
      recipients,
    );
    const emails: MailDataRequired[] = recipientEmails
      .filter(({ email }) => email)
      .map(({ email }) => ({
        ...notification,
        from: this.senderEmail,
        to: email!,
      }));
    return sgMail.send(emails).then(() => {});
  }
}
