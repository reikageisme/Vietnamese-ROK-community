import os
import time

from redis import Redis


def main() -> None:
    client = Redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
    heartbeat = client.get("rokfaq:ocr:heartbeat")
    if heartbeat is None or time.time() - float(heartbeat) > 45:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

