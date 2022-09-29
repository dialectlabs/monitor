import { Notification, ResourceId } from './data-model';
import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import sgMail from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { NotificationTypeEligibilityPredicate } from './internal/notification-type-eligibility-predicate';
import { PublicKey } from '@solana/web3.js';

/**
 * Email notification
 */
export interface EmailNotification extends Notification {
  mail: MailData;
  custom?: Map<PublicKey, MailData>;
}

export interface MailData {
  subject: string;
  text: string;
}

export class SengridEmailNotificationSink
  implements NotificationSink<EmailNotification>
{
  constructor(
    private readonly sengridApiKey: string,
    private readonly senderEmail: string,
    private readonly subscriberRepository: SubscriberRepository,
    private readonly notificationTypeEligibilityPredicate: NotificationTypeEligibilityPredicate,
  ) {
    sgMail.setApiKey(sengridApiKey);
  }

  async push(
    notification: EmailNotification,
    recipients: ResourceId[],
    { notificationMetadata }: NotificationSinkMetadata,
  ) {
    const recipientEmails = await this.subscriberRepository.findAll(recipients);
    console.log('sendgrid-notif-sink, recipients:\n');
    console.log(recipientEmails);
    const emails: MailDataRequired[] = recipientEmails
      .filter(({ email }) => Boolean(email))
      .filter((it) =>
        this.notificationTypeEligibilityPredicate.isEligible(
          it,
          notificationMetadata,
        ),
      )
      .map((subscriber) => {
        let subject = notification.mail.subject;
        let text = notification.mail.text;
        
        // try find custom mail data
        if (notification.custom) {
        let tryFindCustom = notification.custom.get(
          subscriber.wallet!,
        );
        if (tryFindCustom) {
          subject = tryFindCustom.subject;
          text = tryFindCustom.text;
        }
      }

        return ({
        subject: subject,
        text: text,
        from: this.senderEmail,
        to: subscriber.email!,
      })
    });

    const results = await Promise.allSettled(await sgMail.send(emails));

    const failedSends = results
      .filter((it) => it.status === 'rejected')
      .map((it) => it as PromiseRejectedResult);
    if (failedSends.length > 0) {
      console.log(
        `Failed to send dialect email notification to ${
          failedSends.length
        } recipient(s), reasons: 
        ${failedSends.map((it) => it.reason)}
        `,
      );
    }

    return;
  }
}
