import {
  DataPackage,
  DataSourceMetadata,
  PollableDataSource,
  ResourceId,
} from '../src';

export type SomeOnChainObject = {
  name: string;
  value: number;
};
export const OBJECT_PARAMETER_ID = 'EXAMPLE_OBJECT_PARAMETER_ID';

const OBJECT_DATASOURCE_METADATA: DataSourceMetadata = {
  id: 'ObjectDataSource',
  parameters: [
    {
      id: OBJECT_PARAMETER_ID,
      description: 'This is an example parameter decs.',
    },
  ],
};

export class ExampleObjectDataSource
  implements PollableDataSource<SomeOnChainObject>
{
  connect(): Promise<DataSourceMetadata> {
    return Promise.resolve(OBJECT_DATASOURCE_METADATA);
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  extract(subscribers: ResourceId[]): Promise<DataPackage<SomeOnChainObject>> {
    return Promise.resolve(
      subscribers
        .map((resouceId) => {
          return OBJECT_DATASOURCE_METADATA.parameters.map(
            ({ id: parameterId }) => ({
              resourceId: resouceId,
              parameterData: {
                parameterId,
                data: {
                  name: 'Hello, world!',
                  value: Math.random(),
                },
              },
            }),
          );
        })
        .flat(),
    );
  }
}
