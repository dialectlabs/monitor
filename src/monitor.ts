import { Keypair, PublicKey } from "@solana/web3.js";
import { Observable } from "rxjs";
import { Program } from "@project-serum/anchor";
import { Duration } from "luxon";
import { DefaultMonitorFactory } from "./internal/default-monitor-factory";
import { Operators, PipeLogLevel } from "./monitor-pipeline-operators";

/**
 * Parameter id is a unique name of monitored entity
 */
export type ParameterId = string;

/**
 * Parameter may have some metadata
 */
export type Parameter = {
  id: ParameterId;
  description?: string;
};

/**
 * Parameter-bound data (i.e. parameter measurement)
 */
export type ParameterData<T> = { parameterId: ParameterId; data: T };

export type DataSourceMetadata = {
  id: string;
  parameters: Parameter[];
};

/**
 * A user or a dApp, just an alias to
 */
export type ResourceId = PublicKey;

/**
 * Resource-bound parameter data (i.e. a parameter measurement bound to a specific user)
 */
export type ResourceParameterData<T> = {
  resourceId: ResourceId;
  parameterData: ParameterData<T>;
};

/**
 * A batch of multiple parameter data
 */
export type DataPackage<T> = ResourceParameterData<T>[];

/**
 * An abstraction that represents a source of data, bound to specific type
 */
export interface DataSource<T> {
  connect(): Promise<DataSourceMetadata>;

  disconnect(): Promise<void>;
}

/**
 * Pollable data source will be polled by framework to get next datapackage
 */
export interface PollableDataSource<T> extends DataSource<T> {
  extract(subscribers: ResourceId[]): Promise<DataPackage<T>>;
}

/**
 * A set of transformations that are executed on-top of unbound data stream to detect events
 */
export type EventDetectionPipeline<T> = (
  source: Observable<ResourceParameterData<T>>
) => Observable<Event>;

export type SubscriberEventHandler = (subscriber: ResourceId) => any;

/**
 * Repository containing all subscribers, also provides subscribe semantics to get updates
 */
export interface SubscriberRepository {
  /**
   * Return all subscribers of the monitor
   */
  findAll(): Promise<ResourceId[]>;

  /**
   * Finds subscriber by resource id
   */
  findByResourceId(resourceId: ResourceId): Promise<ResourceId | null>;

  /**
   * Can be used to set handlers to react if set of subscribers is changed
   */
  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler
  ): any;
}

/**
 * An interface that abstracts the destination where events are sent/persisted
 */
export interface EventSink {
  push(event: Event, recipients: ResourceId[]): Promise<void>;
}

/**
 * A parameter state that was detected by pipeline and need to be sent to subscribers
 */
export interface Event {
  timestamp: Date;
  type: "warning" | "info";
  title: string;
  message: string;
}

/**
 * A monitor is an entity that is responsible for execution of unbounded streaming ETL (Extract, Transform, Load)
 * and connects DataSource, EventDetectionPipeline and EventSink
 */
export interface Monitor<T> {
  start(): Promise<void>;

  stop(): Promise<void>;
}

export type SubscriberEvent = "added" | "removed";

/**
 * A set of factory methods to create monitors
 */
export class Monitors {
  private static factoryInstance: DefaultMonitorFactory;

  static create<T extends object>(): SetDataSourceStep<T> {
    throw new Error();
  }

  private constructor() {
  }

  static factory(props: MonitorFactoryProps): MonitorFactory {
    if (!Monitors.factoryInstance) {
      Monitors.factoryInstance = new DefaultMonitorFactory(props);
    }
    return Monitors.factoryInstance;
  }

  static async shutdown() {
    return Monitors.factoryInstance && Monitors.factoryInstance.shutdown();
  }
}

interface SetDataSourceStep<T extends object> {
  extract(
    dataSource: (subscribers: ResourceId[]) => Data<T>[]
  ): AddTransformationStep<T, keyof T>;
}

type KeysMatching<T extends object, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

interface Transform<T extends object, R> {
  parameters: KeysMatching<T, R>[];
  pipelines: EventDetectionPipeline<R>[];
}

interface AddTransformationStep<T extends object, KeyType extends keyof T> {
  transform<R>(transform: Transform<T, R>): AddTransformationStep<T, KeyType>;

  also(): AddTransformationStep<T, KeyType>;

  dispatch(): SetDispatchMethodStep;
}


interface SetDispatchMethodStep {

  unicast(): Monitor<any>;

  broadcast(): Monitor<any>;
}


export type Data<T> = {
  resourceId: ResourceId;
  data: T;
};

export const dummyNumericPipeline2: EventDetectionPipeline<number> = (source) =>
  source.pipe(
    Operators.Event.info(
      "Dummy numeric pipeline 2",
      e({ resourceId, parameterData: { parameterId, data } })
=>
`Hello world from (${resourceId}, ${parameterId}): ${data}`,
),
Operators.Utility.log(PipeLogLevel.INFO),
)
;

export const forward: EventDetectionPipeline<string> = (source) =>
  source.pipe(
    Operators.Event.info(
      "Dummy numeric pipeline 2",
      ({ resourceId, parameterData: { parameterId, data } }) =>
        `Hello world from (${resourceId}, ${parameterId}): ${data}`
    ),
    Operators.Utility.log(PipeLogLevel.INFO)
  );

export class Pipelines {
  static fallingEdge(threshold: number) {
    return dummyNumericPipeline2;
  }

  static risingEdge(threshold: number) {
    return dummyNumericPipeline2;
  }

  static forward() {
    return forward;
  }
}

interface MonitorFactoryProps {
  dialectProgram?: Program;
  monitorKeypair?: Keypair;
  eventSink?: EventSink;
  subscriberRepository?: SubscriberRepository;
}

export interface MonitorFactory {
  createUnicastMonitor<T>(
    dataSource: PollableDataSource<T>,
    eventDetectionPipelines: Record<ParameterId, EventDetectionPipeline<T>[]>,
    pollInterval: Duration
  ): Monitor<T>;

  createSubscriberEventMonitor(
    eventDetectionPipelines: EventDetectionPipeline<SubscriberEvent>[]
  ): Monitor<SubscriberEvent>;
}

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//

type DataType = {
  cratio: number;
  cratio2: number;
  smth: string;
};

const monitor = Monitors.create<DataType>()
  .extract((subscribers: ResourceId[]) => [
    {
      data: {
        smth: "31231",
        cratio: 312,
        cratio2: 331
      },
      resourceId: subscribers[0]
    }
  ])
  .transform({
    parameters: ["cratio", "cratio2"],
    pipelines: [Pipelines.fallingEdge(111), Pipelines.risingEdge(150)]
  })
  .also()
  .transform({
    parameters: ["smth"],
    pipelines: [Pipelines.forward()]
  })
  .dispatch()
  .unicast();

Monitors.create().extract((subscribers) => 3);
