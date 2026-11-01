# Classifier checkpoint

`leaf_classifier.pth` is the MobileNetV2 checkpoint consumed by `services/classifier.py`.
The bundled legacy file is a raw state dictionary with five output classes in documented
alphabetical order: Guava, Lemon, Lychee, Mango, Olive. New checkpoints from `train.py`
include explicit labels and architecture metadata; both formats are supported.
Inference uses the same resize, center crop, and ImageNet normalization as `train.py`.
No pretrained weight download or random prediction fallback is used at startup.

Train a replacement from `ai-service` with:

```sh
python train.py --dataset /path/to/dataset --epochs 10 --batch-size 32
```

This overwrites the bundled checkpoint when validation improves. Back it up first.
The dataset and an independently verified accuracy report are not included.
Detection uses a configured remote Roboflow workflow, not the generic YOLO files.
