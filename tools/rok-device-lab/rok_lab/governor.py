from __future__ import annotations

import math
import re
from typing import Any


def digits(value: str) -> int | None:
    cleaned = re.sub(r"\D", "", value)
    return int(cleaned) if cleaned else None


def clean_name(value: str) -> str:
    return value.replace("@", "").replace("©", "").strip(" |}»﹜_-、„。醪")


def clean_alliance(value: str) -> tuple[str, str]:
    cleaned = clean_name(value)
    match = re.search(r"\[([^\]]{1,16})\]\s*(.*)", cleaned)
    if not match:
        return "", cleaned
    return match.group(1).strip(), match.group(2).strip()


def finalize_record(record: dict[str, Any]) -> dict[str, Any]:
    tiers = [int(record.get(f"t{tier}Kills") or 0) for tier in range(1, 6)]
    tier_kp = [int(record.get(f"t{tier}KillPoints") or 0) for tier in range(1, 6)]
    record["totalKills"] = sum(tiers)
    record["t45Kills"] = tiers[3] + tiers[4]
    expected_kp = (
        math.floor(tiers[0] * 0.2)
        + tiers[1] * 2
        + tiers[2] * 4
        + tiers[3] * 10
        + tiers[4] * 20
    )
    total_kp = int(record.get("killPoints") or 0)
    tier_kp_total = sum(tier_kp)
    if expected_kp == tier_kp_total and total_kp != expected_kp:
        record["killPointsOcr"] = total_kp
        record["killPoints"] = expected_kp
        record["killPointsReconstructed"] = True
        total_kp = expected_kp
    record["killsValidated"] = expected_kp == total_kp
    record["tierKillPointsValidated"] = tier_kp_total == total_kp
    required = ("governorId", "name", "power", "killPoints")
    record["needsReview"] = any(record.get(field) in (None, "") for field in required)
    if not record["killsValidated"] and not record["tierKillPointsValidated"]:
        record["needsReview"] = True
    return record


def collector_record(record: dict[str, Any]) -> dict[str, str]:
    return {
        "governorId": str(record.get("governorId") or ""),
        "name": str(record.get("name") or ""),
        "allianceTag": str(record.get("allianceTag") or ""),
        "allianceName": str(record.get("allianceName") or ""),
        "power": str(record.get("power") or 0),
        "killPoints": str(record.get("killPoints") or 0),
        "deadTroops": str(record.get("deadTroops") or 0),
        "t1Kills": str(record.get("t1Kills") or 0),
        "t2Kills": str(record.get("t2Kills") or 0),
        "t3Kills": str(record.get("t3Kills") or 0),
        "t4Kills": str(record.get("t4Kills") or 0),
        "t5Kills": str(record.get("t5Kills") or 0),
        "rangedPoints": str(record.get("rangedPoints") or 0),
        "resourcesGathered": str(record.get("resourcesGathered") or 0),
        "helps": str(record.get("helps") or 0),
    }
