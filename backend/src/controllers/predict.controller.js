const axios = require('axios');
const sharp = require('sharp');
const Prediction = require('../models/Prediction');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/predict
 * Core pipeline: upload → validate → detect → classify → thumbnail → store → respond.
 * Maps to F.2 through F.8.
 */
const predict = async (req, res, next) => {
  try {
    // Step 1: File already validated by Multer middleware (MIME, size) — F.3
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    let imageBuffer;
    try {
      imageBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize(640, 640, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (error) {
      console.error('Image decode error:', error.message);
      return res.status(400).json({ error: 'Could not read the uploaded image.' });
    }
    const imageMimeType = 'image/jpeg';
    const metadata = await sharp(imageBuffer).metadata();

    // Step 3: Send to AI service /detect — F.4
    const FormData = require('form-data');
    const detectForm = new FormData();
    detectForm.append('file', imageBuffer, {
      filename: 'normalized_leaf.jpg',
      contentType: imageMimeType,
    });

    let detectResponse;
    try {
      detectResponse = await axios.post(`${AI_SERVICE_URL}/detect`, detectForm, {
        headers: detectForm.getHeaders(),
        timeout: 12000,
      });
    } catch (aiError) {
      if (aiError.response && (aiError.response.status === 400 || aiError.response.status === 422)) {
        return res.status(aiError.response.status).json({
          error: aiError.response.data?.detail || aiError.response.data?.error || 'Validation failed.',
        });
      }

      return res.status(503).json({ error: 'Leaf detection is unavailable. Please try again later.' });
    }

    const { leaf_count, boxes } = detectResponse.data;
    if (leaf_count !== 1) {
      return res.status(422).json({
        error: leaf_count === 0 ? 'No leaf detected. Upload a clear photo of one leaf.'
          : `Only one leaf image should be uploaded. Detected ${leaf_count} leaves.`,
        leafCount: leaf_count,
      });
    }
    if (!Array.isArray(boxes) || boxes.length !== 1 || boxes[0].length !== 4 ||
        !boxes[0].every(Number.isFinite)) {
      return res.status(502).json({ error: 'Invalid detection result from AI service.' });
    }

    // Step 5: Crop to the single detected bounding box
    const [x1, y1, x2, y2] = boxes[0];
    const left = Math.max(0, Math.min(metadata.width, Math.floor(x1)));
    const top = Math.max(0, Math.min(metadata.height, Math.floor(y1)));
    const cropWidth = Math.min(metadata.width, Math.ceil(x2)) - left;
    const cropHeight = Math.min(metadata.height, Math.ceil(y2)) - top;
    if (cropWidth <= 0 || cropHeight <= 0) {
      return res.status(502).json({ error: 'Invalid leaf bounding box from AI service.' });
    }

    let croppedBuffer;
    try {
      croppedBuffer = await sharp(imageBuffer)
        .extract({
          left,
          top,
          width: cropWidth,
          height: cropHeight,
        })
        .toBuffer();
    } catch (cropError) {
      console.error('Image crop error:', cropError.message);
      return res.status(500).json({ error: 'Failed to process the detected leaf region.' });
    }

    // Step 6: Send cropped image to AI service /classify — F.6
    const classifyForm = new FormData();
    classifyForm.append('file', croppedBuffer, {
      filename: 'cropped_leaf.jpg',
      contentType: 'image/jpeg',
    });

    let classifyResponse;
    try {
      classifyResponse = await axios.post(`${AI_SERVICE_URL}/classify`, classifyForm, {
        headers: classifyForm.getHeaders(),
        timeout: 12000,
      });
    } catch (aiError) {
      return res.status(503).json({ error: 'Leaf classification is unavailable. Please try again later.' });
    }

    const { species, confidence } = classifyResponse.data;
    if (!['Guava', 'Lemon', 'Lychee', 'Mango', 'Olive'].includes(species) ||
        !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
      return res.status(502).json({ error: 'Invalid classification result from AI service.' });
    }

    // Step 7: Generate compressed thumbnail (150×150), discard full-res — F.8
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(150, 150, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Full-resolution imageBuffer is now eligible for GC — we don't store it.

    // Step 8: Write prediction to database
    const prediction = new Prediction({
      userId: req.user._id,
      species,
      confidenceScore: Math.round(confidence * 100) / 100, // Normalize to 0-100
      timestamp: new Date(),
      thumbnail: {
        data: thumbnailBuffer,
        contentType: 'image/jpeg',
      },
    });

    await prediction.save();

    // Step 9: Return result to frontend — F.7
    res.status(201).json({
      message: 'Prediction successful.',
      prediction: {
        id: prediction._id,
        species: prediction.species,
        confidence: prediction.confidenceScore,
        timestamp: prediction.timestamp,

      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { predict };
