import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});

const TABLE_NAME = "WebSocketConnections";

export const handler = async (event) => {
  const { requestContext } = event;
  const connectionId = requestContext.connectionId;
  const routeKey = requestContext.routeKey;

  console.log("WS event:", routeKey, connectionId);

  if (routeKey === "$connect") {
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          connectionId: { S: connectionId },
          connectedAt: { N: Date.now().toString() }
        }
      })
    );
  }

  if (routeKey === "$disconnect") {
    await dynamo.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          connectionId: { S: connectionId }
        }
      })
    );
  }

  return { statusCode: 200 };
};
