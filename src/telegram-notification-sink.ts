import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import { Context, Telegraf } from 'telegraf';

/**
 * Telegram notification
 */
export interface TelegramNotification extends Notification {
  body: string;
}

export type TelegramChatId = string;

export type ResourceTelegram = {
  resourceId: ResourceId;
  telegramChatId: TelegramChatId;
};

export interface ResourceTelegramChatIdRepository {
  // a telegram user's handle is verified/registered with our bot and a chatId is created,
  // so this map is subscriber to their chatId for our bot (not their og handle)
  findBy(resourceIds: ResourceId[]): Promise<ResourceTelegram[]>;
}

export class TelegramNotificationSink
  implements NotificationSink<TelegramNotification>
{
  private bot: Telegraf;
  constructor(
    private readonly telegramBotToken: string,
    private readonly resourceIdToReceiverTelegramChatIdMapper: ResourceTelegramChatIdRepository,
  ) {
    this.bot = new Telegraf(telegramBotToken);
  }

  async push(notification: TelegramNotification, recipients: ResourceId[]) {
    const recipientTelegramNumbers = await this.resourceIdToReceiverTelegramChatIdMapper.findBy(
      recipients,
    );

    // TODO update tg bot chat
    return Promise.allSettled(recipientTelegramNumbers.map(({ telegramChatId }) => {
      this.bot.telegram.sendMessage(telegramChatId, notification.body).then(() => {});
    })).then(() => {});
  }
}
