// import {
//   DataPackage,
//   DataSourceMetadata,
//   PollableDataSource,
//   ResourceId,
// } from '../src';
//
// export const NUMERIC_PARAMETER1_ID = 'NUMERIC_PARAMETER1_ID';
// export const NUMERIC_PARAMETER2_ID = 'NUMERIC_PARAMETER2_ID';
//
// const NUMERIC_DATASOURCE_METADATA: DataSourceMetadata = {
//   id: 'NumericDataSource',
//   parameters: [
//     {
//       id: NUMERIC_PARAMETER1_ID,
//       description: 'This is an optional parameter description',
//     },
//     {
//       id: NUMERIC_PARAMETER2_ID,
//     },
//   ],
// };
//
// export class NumericDataSource implements PollableDataSource<number> {
//   connect(): Promise<DataSourceMetadata> {
//     return Promise.resolve(NUMERIC_DATASOURCE_METADATA);
//   }
//
//   disconnect(): Promise<void> {
//     return Promise.resolve();
//   }
//
//   extract(subscribers: ResourceId[]): Promise<DataPackage<number>> {
//     return Promise.resolve(
//       subscribers
//         .map((resourceId) => {
//           return NUMERIC_DATASOURCE_METADATA.parameters.map(
//             ({ id: parameterId }) => ({
//               resourceId,
//               parameterData: {
//                 parameterId,
//                 data: Math.random(),
//               },
//             }),
//           );
//         })
//         .flat(),
//     );
//   }
// }
