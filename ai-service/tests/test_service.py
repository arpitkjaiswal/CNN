import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from services.classifier import LeafClassifier
from services.detector import LeafDetector

class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classifier = LeafClassifier()
        app.state.classifier = cls.classifier
        app.state.detector = None
        cls.client = TestClient(app)
        cls.image = (Path(__file__).resolve().parents[2] / 'test_leaf.png').read_bytes()

    def test_real_checkpoint_inference(self):
        result = self.client.post('/classify', files={'file': ('leaf.png', self.image, 'image/png')})
        self.assertEqual(result.status_code, 200)
        self.assertIn(result.json()['species'], self.classifier.classes)
        self.assertTrue(0 <= result.json()['confidence'] <= 100)

    def test_missing_detector(self):
        self.assertEqual(self.client.post('/detect', files={'file': ('leaf.png', self.image, 'image/png')}).status_code, 503)

    def test_invalid_mime(self):
        self.assertEqual(self.client.post('/classify', files={'file': ('x.txt', b'x', 'text/plain')}).status_code, 400)

    def test_empty_upload(self):
        self.assertEqual(self.client.post('/classify', files={'file': ('x.png', b'', 'image/png')}).status_code, 400)

    def test_workflow_coordinate_conversion_and_deduplication(self):
        detector = object.__new__(LeafDetector)
        detector.predict_bytes = lambda _: {'result': [{'predictions': [
            {'x': 50, 'y': 40, 'width': 20, 'height': 10, 'confidence': .9},
            {'x': 50, 'y': 40, 'width': 20, 'height': 10, 'confidence': .9},
            {'x': 20, 'y': 20, 'width': 10, 'height': 10, 'confidence': .01},
        ]}]}
        self.assertEqual(detector.detect(b'image'), {'leaf_count': 1, 'boxes': [[40, 35, 60, 45]]})

if __name__ == '__main__':
    unittest.main()
