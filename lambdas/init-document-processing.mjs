import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { TextractClient, StartDocumentTextDetectionCommand } from "@aws-sdk/client-textract";
import { randomUUID } from "crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamo = new DynamoDBClient({});
const textract = new TextractClient({});
const lambda = new LambdaClient({});

const TEXTRACT_SNS_TOPIC_ARN = 'arn:aws:sns:eu-central-1:962621570681:TextractJobCompletedTopic';
const TEXTRACT_SNS_ROLE_ARN = 'arn:aws:iam::962621570681:role/TextractSNSPublishRole';
const THUMBNAIL_FUNCTION_NAME = "thumbnail-generator";

export const handler = async (event) => {
  console.log("Init Lambda triggered");

  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const s3Key = decodeURIComponent(
    record.s3.object.key.replace(/\+/g, " ")
  );

  const jobId = randomUUID();
  const now = Date.now();

  // Create initial job

  await dynamo.send(
    new PutItemCommand({
      TableName: "DocumentProcessingJobs",
      Item: {
        jobId: { S: jobId },
        status: { S: "IN_PROGRESS" },
        ocrStatus: { S: "PENDING" },
        thumbnailStatus: { S: "PENDING" },
        s3Key: { S: s3Key },
        startedAt: { N: now.toString() },
        updatedAt: { N: now.toString() }
      }
    })
  );

  console.log("Job created:", jobId);

  // Start Textract (async)

  const textractResponse = await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
          Name: s3Key
        }
      },
      JobTag: jobId,
      NotificationChannel: {
        SNSTopicArn: TEXTRACT_SNS_TOPIC_ARN,
        RoleArn: TEXTRACT_SNS_ROLE_ARN
      }
    })
  );

  const textractJobId = textractResponse.JobId;

  console.log("Textract started:", textractJobId);

  await dynamo.send(
    new UpdateItemCommand({
      TableName: "DocumentProcessingJobs",
      Key: { jobId: { S: jobId } },
      UpdateExpression: `
        SET ocrStatus = :inProgress,
            ocrStartedAt = :now,
            textractJobId = :textractJobId,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ":inProgress": { S: "IN_PROGRESS" },
        ":now": { N: now.toString() },
        ":textractJobId": { S: textractJobId }
      }
    })
  );

  // Invoke Thumbnail Lambda (async)

  await lambda.send(
    new InvokeCommand({
      FunctionName: THUMBNAIL_FUNCTION_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(
        JSON.stringify({
          jobId,
          bucket,
          s3Key
        })
      )
    })
  );

  console.log("Thumbnail Lambda invoked");

  return {
    statusCode: 200,
    body: JSON.stringify({
      jobId,
      textractJobId
    })
  };
};
