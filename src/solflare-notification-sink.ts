import { Notification, ResourceId } from './data-model';
import { NotificationSink } from './ports';
import axios from 'axios';

/**
 * Solflare notification
 */
export interface SolflareNotification extends Notification {
  title: string;
  body: string;
  actionUrl: string | null;
}

export class SolflareNotificationSink
  implements NotificationSink<SolflareNotification>
{
  constructor(
    private readonly solcastApiKey: string,
    private readonly solcastEndpoint: string = 'https://api.solana.cloud/v1',
  ) {
    console.log(
      `olflare-notif-sink init, solcast endpoint: ${this.solcastEndpoint}`,
    );
  }

  async push(
    { title, body, actionUrl }: SolflareNotification,
    publicKeys: ResourceId[],
  ) {
    console.log(`solflare-notif-sink, recipient:\n`);
    console.log(publicKeys);

    const results = await Promise.allSettled(
      publicKeys.map((publicKey) =>
        axios.post(
          `${this.solcastEndpoint}/casts/unicast`,
          {
            title,
            body,
            icon: null,
            image: null,
            publicKey: publicKey.toBase58(),
            platform: 'all',
            topic: 'transactional',
            actionUrl,
          },
          {
            headers: { Authorization: `Basic ${this.solcastApiKey}` },
          },
        ),
      ),
    );

    const failedSends = results
      .filter((it) => it.status === 'rejected')
      .map((it) => it as PromiseRejectedResult);

    if (failedSends.length > 0) {
      console.log(
        `Failed to send dialect solflare notification to ${
          failedSends.length
        } recipient(s), reasons: 
        ${failedSends.map((it) => it.reason)}
        `,
      );
    }
    return;
  }
}
