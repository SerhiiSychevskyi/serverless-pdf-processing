import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand
} from "@aws-sdk/client-dynamodb";

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";

const CONNECTIONS_TABLE = "WebSocketConnections";
const WS_ENDPOINT =
  "https://856uc0mf7l.execute-api.eu-central-1.amazonaws.com/production";

const dynamo = new DynamoDBClient({});
const wsApi = new ApiGatewayManagementApiClient({
  endpoint: WS_ENDPOINT
});

export const handler = async (event) => {
  console.log("DynamoDB Stream event:", JSON.stringify(event, null, 2));

  // Receive all active connections
  const connectionsResult = await dynamo.send(
    new ScanCommand({ TableName: CONNECTIONS_TABLE })
  );

  if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
    console.log("No active WebSocket connections");
    return;
  }

  // Handle all stream records
  for (const record of event.Records) {
    if (!record.dynamodb?.NewImage) continue;

    const image = record.dynamodb.NewImage;

    const payload = {
      type: "DOCUMENT_UPDATED",
      eventName: record.eventName, // INSERT | MODIFY

      // identity
      jobId: image.jobId?.S,
      s3Key: image.s3Key?.S,

      // global status
      status: image.status?.S, // IN_PROGRESS | DONE | FAILED
      errorMessage: image.errorMessage?.S ?? null,

      // OCR
      ocrStatus: image.ocrStatus?.S,
      ocrStartedAt: image.ocrStartedAt?.N ?? null,
      ocrFinishedAt: image.ocrFinishedAt?.N ?? null,

      // Thumbnail
      thumbnailStatus: image.thumbnailStatus?.S,
      thumbnailStartedAt: image.thumbnailStartedAt?.N ?? null,
      thumbnailFinishedAt: image.thumbnailFinishedAt?.N ?? null,
      thumbnailUrl: image.thumbnailUrl?.S ?? null,

      // lifecycle
      startedAt: image.startedAt?.N,
      finishedAt: image.finishedAt?.N ?? null,
      updatedAt: image.updatedAt?.N
    };
    console.log("Broadcast payload:", payload);

    const data = Buffer.from(JSON.stringify(payload));

    // Send message to all clients
    for (const item of connectionsResult.Items) {
      const connectionId = item.connectionId.S;

      try {
        await wsApi.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: data
          })
        );
      } catch (err) {
        // 410 = connection closed, clear table
        if (err.statusCode === 410) {
          console.log("Stale connection, deleting:", connectionId);

          await dynamo.send(
            new DeleteItemCommand({
              TableName: CONNECTIONS_TABLE,
              Key: {
                connectionId: { S: connectionId }
              }
            })
          );
        } else {
          console.error("WS send error:", err);
        }
      }
    }
  }
};
