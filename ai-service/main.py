"""
FastAPI AI Service for Leaf Identification System.
Exposes /detect, /classify, and /health endpoints.
Models are loaded into memory at startup for low-latency inference.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

from routers.detect import router as detect_router
from routers.classify import router as classify_router
from services.detector import LeafDetector
from services.classifier import LeafClassifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global model instances (loaded once at startup)
detector: LeafDetector = None
classifier: LeafClassifier = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup, release at shutdown."""
    global detector, classifier

    logger.info("Loading Roboflow leaf detector...")
    try:
        detector = LeafDetector()
    except RuntimeError as exc:
        logger.warning("Detection unavailable: %s", exc)
        detector = None
    logger.info("Detection configuration checked.")

    logger.info("Loading MobileNetV2 leaf classifier...")
    classifier = LeafClassifier()
    logger.info("CNN model loaded successfully.")

    # Store references in app state for access in routes
    app.state.detector = detector
    app.state.classifier = classifier

    yield

    # Cleanup
    logger.info("Shutting down AI service, releasing model resources.")
    del detector, classifier


app = FastAPI(
    title="Leaf Identification AI Service",
    description="Stateless inference microservice for leaf detection (Roboflow) and species classification (CNN).",
    version="1.0.0",
    lifespan=lifespan,
)

# Include routers
app.include_router(detect_router, tags=["Detection"])
app.include_router(classify_router, tags=["Classification"])


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint for status check."""
    return {
        "service": "Leaf Identification AI Service",
        "status": "online",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["Health"])
async def health_check(response: Response):
    """Health check endpoint for container orchestration."""
    if detector is None or classifier is None:
        response.status_code = 503
    return {
        "status": "healthy" if detector and classifier else "degraded",
        "models": {
            "detector": detector is not None,
            "classifier": classifier is not None,
        },
    }
