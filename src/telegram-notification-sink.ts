import { Notification, ResourceId } from './data-model';
import { NotificationSink, SubscriberRepository } from './ports';
import { Telegraf } from 'telegraf';

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
  ) {
    this.bot = new Telegraf(telegramBotToken);
  }

  async push(notification: TelegramNotification, recipients: ResourceId[]) {
    const recipientTelegramNumbers = await this.subscriberRepository.findAll(
      recipients,
    );
    console.log('tg-notif-sink, recipients:\n');
    console.log(recipientTelegramNumbers);

    const results = await Promise.allSettled(
      recipientTelegramNumbers
        .filter(({ telegramChatId }) => telegramChatId)
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
