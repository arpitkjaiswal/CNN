const axios = require('axios');
jest.mock('axios');
jest.mock('../src/models/Prediction', () => jest.fn().mockImplementation(data => ({
  ...data, _id: 'prediction-id', save: jest.fn().mockResolvedValue(),
})));
const sharp = require('sharp');
const Prediction = require('../src/models/Prediction');
const { predict } = require('../src/controllers/predict.controller');

let req, res, next;
beforeEach(async () => {
  jest.clearAllMocks();
  req = { file: { buffer: await sharp({ create: { width: 640, height: 640, channels: 3, background: 'green' } }).png().toBuffer(), originalname: 'mango.png' }, user: { _id: 'user-id' } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  next = jest.fn();
});
test('unavailable detection never fabricates a prediction', async () => {
  axios.post.mockRejectedValueOnce(new Error('offline'));
  await predict(req, res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(Prediction).not.toHaveBeenCalled();
});
test.each([0, 2])('rejects %i detected leaves', async count => {
  axios.post.mockResolvedValueOnce({ data: { leaf_count: count, boxes: [] } });
  await predict(req, res, next);
  expect(res.status).toHaveBeenCalledWith(422);
  expect(Prediction).not.toHaveBeenCalled();
});
test('clamps out-of-bounds coordinates and preserves percent confidence', async () => {
  axios.post.mockResolvedValueOnce({ data: { leaf_count: 1, boxes: [[-10, -10, 700, 700]] } })
    .mockResolvedValueOnce({ data: { species: 'Mango', confidence: 92.15 } });
  await predict(req, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json.mock.calls[0][0].prediction.confidence).toBe(92.15);
});
test('classification failure never saves filename-based guesses', async () => {
  axios.post.mockResolvedValueOnce({ data: { leaf_count: 1, boxes: [[0, 0, 640, 640]] } })
    .mockRejectedValueOnce(new Error('offline'));
  await predict(req, res, next);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(Prediction).not.toHaveBeenCalled();
});
test('rejects invalid confidence', async () => {
  axios.post.mockResolvedValueOnce({ data: { leaf_count: 1, boxes: [[0, 0, 640, 640]] } })
    .mockResolvedValueOnce({ data: { species: 'Mango', confidence: 150 } });
  await predict(req, res, next);
  expect(res.status).toHaveBeenCalledWith(502);
});
