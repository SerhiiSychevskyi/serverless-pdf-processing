import {
  TextractClient,
  GetDocumentTextDetectionCommand
} from "@aws-sdk/client-textract";

import {
  DynamoDBClient,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";

const textract = new TextractClient({});
const dynamo = new DynamoDBClient({});

export const handler = async (event) => {
  console.log("SQS event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    // 1) SQS -> SNS -> Textract
    const sqsBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(sqsBody.Message);

    const JobId = snsMessage.JobId;
    const JobStatus = snsMessage.Status;   // ← ФІКС
    const jobId = snsMessage.JobTag;

    console.log("Textract callback:", { JobId, JobStatus, jobId });

    const now = Date.now();

    // 2) FAILED
    if (JobStatus !== "SUCCEEDED") {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: "DocumentProcessingJobs",
          Key: { jobId: { S: jobId } },
          UpdateExpression: `
            SET ocrStatus = :failed,
                #status = :failedStatus,
                errorMessage = :error,
                finishedAt = :now,
                updatedAt = :now
          `,
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":failed": { S: "FAILED" },
            ":failedStatus": { S: "FAILED" },
            ":error": { S: `Textract status: ${JobStatus}` },
            ":now": { N: now.toString() }
          }
        })
      );
      continue;
    }

    // 3) SUCCESS -> OCR result
    const textResponse = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId })
    );

    const ocrText =
      textResponse.Blocks
        ?.filter(b => b.BlockType === "LINE")
        .map(b => b.Text)
        .join("\n") ?? "";

    // 4) Update OCR data
    await dynamo.send(
      new UpdateItemCommand({
        TableName: "DocumentProcessingJobs",
        Key: { jobId: { S: jobId } },
        UpdateExpression: `
          SET ocrStatus = :done,
              ocrText = :text,
              updatedAt = :now
        `,
        ExpressionAttributeValues: {
          ":done": { S: "DONE" },
          ":text": { S: ocrText },
          ":now": { N: now.toString() }
        }
      })
    );

    // 5) Aggregation logic
    try {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: "DocumentProcessingJobs",
          Key: { jobId: { S: jobId } },
          UpdateExpression: `
            SET #status = :done,
                finishedAt = :now,
                updatedAt = :now
          `,
          ConditionExpression: `
            ocrStatus = :done AND thumbnailStatus = :done
          `,
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":done": { S: "DONE" },
            ":now": { N: now.toString() }
          }
        })
      );

      console.log("Aggregation completed: job DONE");
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        console.log("Aggregation skipped: thumbnail not finished yet");
      } else {
        throw err;
      }
    }
  }
};
