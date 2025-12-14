import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client({});
const dynamo = new DynamoDBClient({});

const TABLE_NAME = "DocumentProcessingJobs";
const DEFAULT_BUCKET = "serverless-pdf-processing";

export const handler = async (event) => {
  const jobId = event?.jobId;
  const bucket = event?.bucket || DEFAULT_BUCKET;
  const s3Key = event?.s3Key;

  if (!jobId) throw new Error("Missing required field: jobId");
  if (!bucket) throw new Error("Missing required field: bucket (or set BUCKET_NAME env)");
  if (!s3Key) throw new Error("Missing required field: s3Key");

  const now = Date.now();
  console.log("Thumbnail Lambda invoked:", { jobId, bucket, s3Key });

  // 1) Mark start of thumbnail generation
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
      UpdateExpression: "SET thumbnailStatus = :inprog, thumbnailStartedAt = if_not_exists(thumbnailStartedAt, :now), updatedAt = :now",
      ExpressionAttributeValues: {
        ":inprog": { S: "IN_PROGRESS" },
        ":now": { N: String(now) }
      }
    })
  );

  // 2) Prepare PDF
  const fileName = safeFileNameFromKey(s3Key);
  const svg = buildSvgThumbnail({
    title: fileName,
    subtitle: `jobId: ${jobId}`,
    meta: new Date(now).toISOString()
  });

  // 3) Save SVG to S3
  const thumbnailKey = `thumbnails/${jobId}.svg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: thumbnailKey,
      Body: svg,
      ContentType: "image/svg+xml; charset=utf-8",
      CacheControl: "no-store"
    })
  );

  const thumbnailUrl = `s3://${bucket}/${thumbnailKey}`;
  const finished = Date.now();

  // 4) Update DynamoDB
  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
      UpdateExpression:
        "SET thumbnailStatus = :done, thumbnailFinishedAt = :fin, thumbnailKey = :tkey, thumbnailUrl = :turl, updatedAt = :fin",
      ExpressionAttributeValues: {
        ":done": { S: "DONE" },
        ":fin": { N: String(finished) },
        ":tkey": { S: thumbnailKey },
        ":turl": { S: thumbnailUrl }
      }
    })
  );

  // 5) Aggregation check
  const job = await dynamo.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { jobId: { S: jobId } },
      ConsistentRead: true
    })
  );

  const ocrStatus = job?.Item?.ocrStatus?.S;
  const status = job?.Item?.status?.S;

  console.log("Aggregation check:", { ocrStatus, status });

  if (ocrStatus === "DONE" && status !== "DONE") {
    const doneAt = Date.now();

    await dynamo.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { jobId: { S: jobId } },
        UpdateExpression: "SET #st = :done, finishedAt = :doneAt, updatedAt = :doneAt",
        ExpressionAttributeNames: {
          "#st": "status" // status не reserved, але тримаємо патерн
        },
        ExpressionAttributeValues: {
          ":done": { S: "DONE" },
          ":doneAt": { N: String(doneAt) }
        }
      })
    );

    console.log("Overall status updated to DONE:", { jobId, doneAt });
  }

  return {
    jobId,
    thumbnailKey,
    thumbnailUrl
  };
};

// ---------- helpers ----------

function safeFileNameFromKey(key) {
  const base = key.split("/").pop() || "document.pdf";
  // дуже простий sanitize, щоб не ламати SVG
  return base.replace(/[<>&"]/g, "_");
}

function buildSvgThumbnail({ title, subtitle, meta }) {
  const width = 480;
  const height = 270;

  const esc = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const t = esc(title);
  const sub = esc(subtitle);
  const m = esc(meta);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="url(#bg)"/>

  <!-- Card -->
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="18" fill="#0b1220" opacity="0.9" filter="url(#shadow)"/>

  <!-- PDF icon -->
  <g transform="translate(52 62)">
    <rect x="0" y="0" width="72" height="90" rx="10" fill="#111827" stroke="#334155" stroke-width="2"/>
    <path d="M52 0 L72 20 L52 20 Z" fill="#0b1220" stroke="#334155" stroke-width="2"/>
    <rect x="12" y="52" width="48" height="20" rx="6" fill="#b91c1c" opacity="0.95"/>
    <text x="36" y="66" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" fill="#fff" font-weight="700">PDF</text>
  </g>

  <!-- Text -->
  <text x="148" y="92" font-family="Inter, Arial, sans-serif" font-size="18" fill="#e5e7eb" font-weight="700">
    ${t}
  </text>

  <text x="148" y="122" font-family="Inter, Arial, sans-serif" font-size="13" fill="#9ca3af">
    ${sub}
  </text>

  <text x="148" y="150" font-family="Inter, Arial, sans-serif" font-size="12" fill="#6b7280">
    ${m}
  </text>

  <!-- Footer line -->
  <line x1="48" y1="${height - 74}" x2="${width - 48}" y2="${height - 74}" stroke="#1f2937" stroke-width="1"/>

  <text x="48" y="${height - 46}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#94a3b8">
    serverless-pdf-processing · thumbnail
  </text>
</svg>`;
}
