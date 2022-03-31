import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { idl, Wallet_ } from '@dialectlabs/web3';
import { Idl, Program, Provider } from '@project-serum/anchor';
import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';
import { programs } from '@dialectlabs/web3/lib/es';

const SOLANA_ENDPOINT = process.env.RPC_URL || 'http://localhost:8899';
const MONITORING_SERVICE_PRIVATE_KEY = process.env
  .MONITORING_SERVICE_PRIVATE_KEY as string;

const MONITORING_SERVICE_KEYPAIR: Keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(MONITORING_SERVICE_PRIVATE_KEY as string)),
);

// const DIALECT_PROGRAM_ADDRESS = new PublicKey(
//   'BTHDR8UjttR3mX3PwT8MuEKDDzDYwqENYgPHH7QjaJ3y',
// );
const DIALECT_PROGRAM_ADDRESS = programs['localnet'].programAddress;

const wallet = Wallet_.embedded(MONITORING_SERVICE_KEYPAIR.secretKey);

function getDialectProgram(): Program {
  const dialectConnection = new Connection(SOLANA_ENDPOINT, 'recent');
  const dialectProvider = new Provider(
    dialectConnection,
    wallet,
    Provider.defaultOptions(),
  );
  return new Program(
    idl as Idl,
    new PublicKey(DIALECT_PROGRAM_ADDRESS),
    dialectProvider,
  );
}

type DataType = {
  cratio: number;
  healthRatio: number;
};

const dataSourceMonitor: Monitor<DataType> = Monitors.builder({
  dialectProgram: getDialectProgram(),
  monitorKeypair: MONITORING_SERVICE_KEYPAIR,
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<DataType>[] = subscribers.map(
      (resourceId) => ({
        data: {
          cratio: Math.random(),
          healthRatio: Math.random(),
        },
        resourceId,
      }),
    );
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 3 }))
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold: 0.5,
        },
        {
          type: 'throttle-time',
          timeSpan: Duration.fromObject({ minutes: 5 }),
        },
      ),
    ],
  })
  .notify()
  .dialectThread(({ value }) => ({
    message: `Your cratio = ${value} below warning threshold`,
  }))
  .and()
  .dispatch('unicast')
  .build();
dataSourceMonitor.start();
