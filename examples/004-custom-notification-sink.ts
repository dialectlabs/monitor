import { DataSink, ResourceId } from '../src';

export class ConsoleDataSink<R> implements DataSink<R> {
  push(data: R, recipients: ResourceId[]): Promise<void> {
    console.log(
      `Got new notification ${JSON.stringify(
        data,
      )} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
