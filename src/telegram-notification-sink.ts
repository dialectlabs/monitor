import { Notification, ResourceId } from './data-model';
import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import { Telegraf } from 'telegraf';
import { NotificationTypeEligibilityPredicate } from './internal/notification-type-eligibility-predicate';

/**
 * Telegram notification
 */
export interface TelegramNotification extends Notification {
  body: string;
}

export class TelegramNotificationSink
  implements NotificationSink<TelegramNotification>
{
  private bot: Telegraf;

  constructor(
    private readonly telegramBotToken: string,
    private readonly subscriberRepository: SubscriberRepository,
    private readonly notificationTypeEligibilityPredicate: NotificationTypeEligibilityPredicate,
  ) {
    this.bot = new Telegraf(telegramBotToken);
  }

  async push(
    notification: TelegramNotification,
    recipients: ResourceId[],
    { notificationMetadata }: NotificationSinkMetadata,
  ) {
    const recipientTelegramNumbers = await this.subscriberRepository.findAll(
      recipients,
    );
    console.log('tg-notif-sink, recipients:\n');
    console.log(recipientTelegramNumbers);
    const results = await Promise.allSettled(
      recipientTelegramNumbers
        .filter(({ telegramChatId }) => telegramChatId)
        .filter((it) =>
          this.notificationTypeEligibilityPredicate.isEligible(
            it,
            notificationMetadata,
          ),
        )
        .map(({ telegramChatId }) => {
          this.bot.telegram
            .sendMessage(telegramChatId!, notification.body)
            .then(() => {});
        }),
    );

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
    }

    return;
  }
}
