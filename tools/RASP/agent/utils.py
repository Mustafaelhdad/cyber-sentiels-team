import time
import uuid
import logging
import json
import os
from datetime import datetime


def now_ts() -> int:
    """Return current UNIX timestamp."""
    return int(time.time())


def now_readable() -> str:
    """Return a human-readable datetime string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def make_id(prefix: str = "inc") -> str:
    """Generate a short unique ID for each incident."""
    return f"{prefix}-{uuid.uuid4().hex[:10]}"



LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "rasp_incidents.log")

os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("rasp_agent")
logger.setLevel(logging.INFO)

if not logger.handlers:
    file_handler = logging.FileHandler(LOG_FILE)
    console_handler = logging.StreamHandler()

    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)




def log_incident(incident: dict):
    """Log incident to file and stdout in JSON format."""
    try:
        enriched_incident = {
            "time": now_readable(),
            **incident
        }
        logger.info(json.dumps(enriched_incident, ensure_ascii=False, default=str))
    except Exception as e:
        logger.error(f"Error logging incident: {e}")
        logger.info(str(incident))
