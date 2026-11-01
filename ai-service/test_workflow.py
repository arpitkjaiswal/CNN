"""Print the raw configured workflow output (requires Roboflow access)."""
import argparse
from pathlib import Path
from services.detector import LeafDetector

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    args = parser.parse_args()
    print(LeafDetector().predict_bytes(args.image.read_bytes()))
