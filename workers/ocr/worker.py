import io
import json
import logging
import os
import re
import signal
import time
from dataclasses import dataclass
from typing import Any

import boto3
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from redis import Redis


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
LOGGER = logging.getLogger("rokviet.ocr")
NUMBER = r"([0-9][0-9,\.\s]*)"
FIELD_PATTERNS = {
    "governor_id": [rf"(?:governor\s*id|id)\s*[:#]?\s*{NUMBER}"],
    "power": [rf"(?:power|lực\s*chiến)\s*:?\s*{NUMBER}"],
    "kill_points": [rf"(?:kill\s*points?|điểm\s*hạ\s*gục)\s*:?\s*{NUMBER}"],
    "dead_troops": [rf"(?:dead(?:\s*troops?)?|quân\s*tử\s*trận)\s*:?\s*{NUMBER}"],
}


@dataclass(frozen=True)
class Settings:
    redis_url: str = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    queue_key: str = os.environ.get("OCR_QUEUE_KEY", "rokviet:ocr:jobs")
    result_ttl: int = int(os.environ.get("OCR_RESULT_TTL_SECONDS", "604800"))
    max_image_bytes: int = int(os.environ.get("OCR_MAX_IMAGE_BYTES", "15728640"))
    max_image_pixels: int = int(os.environ.get("OCR_MAX_IMAGE_PIXELS", "25000000"))
    endpoint: str = os.environ.get("S3_ENDPOINT", "http://minio:9000")
    region: str = os.environ.get("S3_REGION", "us-east-1")
    access_key: str = os.environ.get("S3_ACCESS_KEY_ID", "rokviet")
    secret_key: str = os.environ.get("S3_SECRET_ACCESS_KEY", "")
    default_bucket: str = os.environ.get("S3_BUCKET", "rokviet-uploads")
    languages: str = os.environ.get("TESSERACT_LANGUAGES", "eng+vie")


def normalize_number(value: str) -> int | None:
    digits = re.sub(r"\D", "", value)
    return int(digits) if digits else None


def prepare_image(payload: bytes, max_pixels: int) -> Image.Image:
    image = Image.open(io.BytesIO(payload))
    if image.width * image.height > max_pixels:
        raise ValueError("image_pixel_limit_exceeded")
    image = ImageOps.exif_transpose(image).convert("L")
    image = ImageEnhance.Contrast(image).enhance(1.8)
    return image.filter(ImageFilter.SHARPEN)


def parse_fields(text: str) -> dict[str, Any]:
    normalized = " ".join(text.lower().split())
    fields: dict[str, Any] = {}
    matched = 0
    for field, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE)
            if match:
                fields[field] = normalize_number(match.group(1))
                matched += 1
                break
    fields["confidence"] = round(matched / len(FIELD_PATTERNS), 2)
    return fields


class OcrWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.endpoint,
            region_name=settings.region,
            aws_access_key_id=settings.access_key,
            aws_secret_access_key=settings.secret_key,
        )
        self.running = True

    def stop(self, *_: object) -> None:
        self.running = False

    def process(self, raw_job: str) -> None:
        job = json.loads(raw_job)
        job_id = str(job["jobId"])
        bucket = str(job.get("bucket") or self.settings.default_bucket)
        object_key = str(job["objectKey"])
        result_key = f"rokviet:ocr:result:{job_id}"

        try:
            response = self.s3.get_object(Bucket=bucket, Key=object_key)
            if int(response.get("ContentLength", 0)) > self.settings.max_image_bytes:
                raise ValueError("image_byte_limit_exceeded")
            payload = response["Body"].read(self.settings.max_image_bytes + 1)
            if len(payload) > self.settings.max_image_bytes:
                raise ValueError("image_byte_limit_exceeded")
            image = prepare_image(payload, self.settings.max_image_pixels)
            raw_text = pytesseract.image_to_string(image, lang=self.settings.languages)
            result = {
                "jobId": job_id,
                "status": "pending_verification",
                "source": {"bucket": bucket, "objectKey": object_key},
                "fields": parse_fields(raw_text),
                "requiresModeratorReview": True,
            }
        except Exception as error:  # Keep the worker alive; the API decides retry policy.
            LOGGER.exception("OCR job %s failed", job_id)
            result = {"jobId": job_id, "status": "failed", "error": type(error).__name__}

        encoded = json.dumps(result, ensure_ascii=False)
        pipeline = self.redis.pipeline()
        pipeline.setex(result_key, self.settings.result_ttl, encoded)
        pipeline.publish("rokviet:ocr:results", encoded)
        pipeline.execute()

    def run(self) -> None:
        LOGGER.info("Listening for OCR jobs on %s", self.settings.queue_key)
        while self.running:
            self.redis.setex("rokviet:ocr:heartbeat", 60, str(time.time()))
            item = self.redis.blpop(self.settings.queue_key, timeout=5)
            if item:
                self.process(item[1])


def main() -> None:
    worker = OcrWorker(Settings())
    signal.signal(signal.SIGTERM, worker.stop)
    signal.signal(signal.SIGINT, worker.stop)
    worker.run()


if __name__ == "__main__":
    main()
