"""Run the configured Roboflow detector: python test_detector.py ../test_leaf.png"""
import argparse
from pathlib import Path
from services.detector import LeafDetector

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    args = parser.parse_args()
    print(LeafDetector().detect(args.image.read_bytes()))
