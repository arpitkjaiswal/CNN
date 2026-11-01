
"""
MobileNetV2 leaf species classification service.
Loads trained MobileNetV2 checkpoint and predicts from image bytes.
"""

import io
import logging
import os
from pathlib import Path

from PIL import Image
import torch
from torchvision import models, transforms

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
CLASSIFIER_WEIGHTS = os.getenv(
    "CLASSIFIER_WEIGHTS",
    str(MODELS_DIR / "leaf_classifier.pth"),
)


class LeafClassifier:
    """MobileNetV2 leaf species classifier wrapper."""

    def __init__(self, weights_path: str = CLASSIFIER_WEIGHTS):
        self.model_path = Path(weights_path)
        if not self.model_path.is_file():
            raise FileNotFoundError(
                f"Trained classification model not found: {self.model_path}"
            )

        checkpoint = torch.load(self.model_path, map_location="cpu", weights_only=True)
        # Legacy raw weights use the documented alphabetical ImageFolder order.
        self.species_labels = checkpoint.get("classes", ["Guava", "Lemon", "Lychee", "Mango", "Olive"])
        if checkpoint.get("architecture", "mobilenet_v2") != "mobilenet_v2":
            raise ValueError("Expected a MobileNetV2 checkpoint produced by train.py")
        self.model = models.mobilenet_v2(weights=None)
        self.model.classifier[1] = torch.nn.Linear(self.model.last_channel, len(self.species_labels))
        self.model.load_state_dict(checkpoint.get("model_state_dict", checkpoint))
        self.model.eval()
        self.transform = transforms.Compose([
            transforms.Resize((256, 256)), transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        self._demo_mode = False
        logger.info("Classifier loaded with classes: %s", self.species_labels)

    @property
    def is_demo_mode(self) -> bool:
        return self._demo_mode

    @property
    def classes(self) -> list:
        return self.species_labels

    def classify(self, image_bytes: bytes) -> dict:
        """Classify a single cropped leaf image from raw image bytes."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as image:
                image = image.convert("RGB")

                tensor = self.transform(image).unsqueeze(0)
                with torch.inference_mode():
                    probabilities = self.model(tensor).softmax(dim=1)[0]
                class_id = int(probabilities.argmax())
                confidence = float(probabilities[class_id]) * 100
                species = self.species_labels[class_id]

            logger.info(
                "Prediction: %s (%.2f%%)",
                species,
                confidence,
            )

            return {
                "species": species,
                "confidence": round(confidence, 2),
            }

        except Exception:
            logger.exception("Leaf classification failed")
            raise
