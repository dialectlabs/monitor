import { Event, EventSink, ResourceId } from '../src';

export class ConsoleEventSink implements EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void> {
    console.log(
      `Got new event ${JSON.stringify(event)} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
