import { S3Client, SelectObjectContentCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { gunzipSync } from 'zlib';

// Use environment variables or fallback to AWS credentials
const client = new S3Client({
  region: process.env.S3_REGION || 'eu-west-2',
  credentials: process.env.S3_ACCESS_KEY ? {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  } : undefined, // Use default AWS credential chain if not set
  ...(process.env.S3_ENDPOINT && { 
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true 
  })
});

const BUCKET = process.env.S3_BUCKET || 'lines-document';

async function test() {
  // List files
  const list = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'index/' }));
  const files = (list.Contents || []).filter(f => f.Key.endsWith('.ndjson.gz'));
  console.log('Found', files.length, 'index files');
  if (files.length === 0) {
    console.log('No index files found. Is the bucket seeded?');
    return;
  }
  
  const key = files[0].Key;
  console.log('Testing S3 Select on:', key);
  
  // First, let's see what's in the file
  console.log('\n--- File content preview ---');
  const getRes = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await getRes.Body.transformToByteArray();
  const content = gunzipSync(Buffer.from(bytes)).toString('utf-8');
  console.log('Raw content:', content.substring(0, 500));
  console.log('Line count:', content.split('\n').filter(l => l.trim()).length);
  
  // Test with LINES format
  console.log('\n--- Testing S3 Select with LINES ---');
  try {
    const cmd = new SelectObjectContentCommand({
      Bucket: BUCKET,
      Key: key,
      ExpressionType: 'SQL',
      Expression: 'SELECT * FROM s3object s',
      InputSerialization: { JSON: { Type: 'LINES' }, CompressionType: 'GZIP' },
      OutputSerialization: { JSON: {} }
    });
    const res = await client.send(cmd);
    console.log('✅ S3 Select (LINES) works!');
    for await (const event of res.Payload) {
      if (event.Records?.Payload) {
        const data = new TextDecoder().decode(event.Records.Payload);
        console.log('Result:', data.substring(0, 200));
      }
    }
  } catch (err) {
    console.log('❌ S3 Select (LINES) failed:', err.message);
    console.log('   Error code:', err.Code || err.name);
    console.log('   Full error:', JSON.stringify(err, null, 2));
  }
  
  // Test with DOCUMENT format
  console.log('\n--- Testing S3 Select with DOCUMENT ---');
  try {
    const cmd = new SelectObjectContentCommand({
      Bucket: BUCKET,
      Key: key,
      ExpressionType: 'SQL',
      Expression: 'SELECT * FROM s3object s',
      InputSerialization: { JSON: { Type: 'DOCUMENT' }, CompressionType: 'GZIP' },
      OutputSerialization: { JSON: {} }
    });
    const res = await client.send(cmd);
    console.log('✅ S3 Select (DOCUMENT) works!');
    for await (const event of res.Payload) {
      if (event.Records?.Payload) {
        const data = new TextDecoder().decode(event.Records.Payload);
        console.log('Result:', data.substring(0, 200));
      }
    }
  } catch (err) {
    console.log('❌ S3 Select (DOCUMENT) failed:', err.message);
  }
}

test().catch(console.error);
