import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  { marshallOptions: { removeUndefinedValues: true } },
);
export const tableName = process.env.TABLE_NAME!;

export const getItem = async (pk: string, sk: string) => {
  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pk, SK: sk },
    }),
  );
  return result.Item;
};

export * from './model';
