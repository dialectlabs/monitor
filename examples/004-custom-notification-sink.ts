import { DataSink, ResourceId } from '../src';

export class ConsoleDataSink implements DataSink<any> {
  push(data: any, recipients: ResourceId[]): Promise<void> {
    console.log(
      `Got new notification ${JSON.stringify(
        data,
      )} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
