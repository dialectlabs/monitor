import { PublicKey } from '@solana/web3.js';
import {
  Subscriber,
  SubscriberEventHandler,
  SubscriberRepository,
} from './ports';
import { ResourceId } from './data-model';
import _ from 'lodash';
import {
  AddressType,
  Dapp,
  DialectSdk,
  IllegalStateError,
} from '@dialectlabs/sdk';

export class DialectSdkSubscriberRepository implements SubscriberRepository {
  dapp: Dapp | null = null;

  constructor(private sdk: DialectSdk) {}

  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    throw new Error('Method not implemented.');
  }

  async findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    const subscribers = await this.findAll();
    return subscribers.find((it) => it.resourceId.equals(resourceId)) ?? null;
  }

  async findAll(resourceIds?: ResourceId[]): Promise<Subscriber[]> {
    const dapp = await this.lookupDapp();
    const dappAddresses = await dapp.dappAddresses.findAll();
    const subscribers = _(dappAddresses)
      .filter(({ enabled, address: { verified } }) => enabled && verified)
      .map((it) => ({
        resourceId: it.address.wallet.publicKey,
        ...(it.address.type === AddressType.Email && {
          email: it.address.value,
        }),
        ...(it.address.type === AddressType.Telegram && {
          telegramChatId: it.channelId,
        }),
        ...(it.address.type === AddressType.PhoneNumber && {
          phoneNumber: it.address.value,
        }),
        ...(it.address.type === AddressType.Wallet && {
          wallet: new PublicKey(it.address.value),
        }),
      }))
      .groupBy('resourceId')
      .mapValues((s, resourceId) => ({
        resourceId: new PublicKey(resourceId),
        telegramChatId: s
          .map(({ telegramChatId }) => telegramChatId)
          .find((it) => it),
        phoneNumber: s.map(({ phoneNumber }) => phoneNumber).find((it) => it),
        email: s.map(({ email }) => email).find((it) => it),
        wallet: s.map(({ wallet }) => wallet).find((it) => it),
      }))
      .values()
      .value();
    return resourceIds
      ? subscribers.filter(({ resourceId }) =>
          resourceIds.find((it) => it.equals(resourceId)),
        )
      : subscribers;
  }

  private async lookupDapp() {
    if (!this.dapp) {
      const dapp = await this.sdk.dapps.find();
      if (!dapp) {
        throw new IllegalStateError(
          `Dapp ${this.sdk.info.wallet.publicKey?.toBase58()} not registered in dialect cloud ${
            this.sdk.info.config.dialectCloud.url
          }`,
        );
      }
      this.dapp = dapp;
    }
    return this.dapp;
  }
}
