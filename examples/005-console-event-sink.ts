import { EventSink, Event, ResourceId } from '../';

export class ConsoleEventSink implements EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void> {
    console.log(`Got new event ${event} for recipients ${recipients}`);
    return Promise.resolve();
  }
}
