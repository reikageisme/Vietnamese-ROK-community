# RokViet OCR worker

This service reads screenshots uploaded by users from S3-compatible storage and
returns candidate profile fields. Every successful result is deliberately marked
`pending_verification`; OCR output must never directly grant the
`screenshot_verified` status.

The web/BullMQ processor can enqueue the following JSON payload on the Redis list
configured by `OCR_QUEUE_KEY` (default: `rokviet:ocr:jobs`):

```json
{
  "jobId": "01J...",
  "bucket": "rokviet-uploads",
  "objectKey": "profiles/user-id/screenshot.png"
}
```

Results are stored at `rokviet:ocr:result:<jobId>` and published to
`rokviet:ocr:results`. The Node BullMQ job remains responsible for authorization,
rate limiting, retries, persistence and moderator-queue creation. This narrow
Redis hand-off keeps the Python OCR runtime independent from the web process.

