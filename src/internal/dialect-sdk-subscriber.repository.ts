import { PublicKey } from '@solana/web3.js';
import {
  Subscriber,
  SubscriberEventHandler,
  SubscriberRepository,
} from '../ports';
import { ResourceId } from '../data-model';
import { AddressType, DialectSdk } from '@dialectlabs/sdk';
import _ from 'lodash';

export class DialectSdkSubscriberRepository implements SubscriberRepository {
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

  async findAll(): Promise<Subscriber[]> {
    const dapp = await this.sdk.dapps.find();
    const dappAddresses = await dapp.dappAddresses.findAll();
    return _(dappAddresses)
      .map((it) => ({
        resourceId: it.address.walletPublicKey,
        ...(it.address.type === AddressType.Email && {
          email: it.address.value,
        }),
        ...(it.address.type === AddressType.Telegram && {
          telegramChatId: it.telegramChatId,
        }),
        ...(it.address.type === AddressType.PhoneNumber && {
          phoneNumber: it.address.value,
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
      }))
      .values()
      .value();
  }
}
