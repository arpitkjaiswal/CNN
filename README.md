# LeafScan — Leaf Identification System

LeafScan is a full-stack application for uploading a single leaf photo, identifying its species, and keeping a private scan history. React provides the interface, Express handles accounts and predictions, MongoDB stores users and thumbnails, and FastAPI runs AI inference.

## What the code actually uses

- **Detection:** a remote Roboflow workflow, configured with your API key, workspace, and workflow ID. The current example workflow targets siam weed; configure and validate a leaf-specific workflow before relying on it for general leaf detection.
- **Classification:** the included `ai-service/models/leaf_classifier.pth` MobileNetV2 checkpoint, loaded on CPU with PyTorch. New checkpoints carry class labels; the bundled legacy weights use the documented alphabetical order: Guava, Lemon, Lychee, Mango, and Olive.
- **Accounts:** password hashing, email OTP verification, JWT sessions, password recovery, temporary deactivation, and administrator access.
- **History:** paginated predictions, owner-only thumbnails, CSV export, and administrative statistics.

Images are normalized to 640 × 640, checked for exactly one leaf, cropped to its bounding box, and classified. Only a 150 × 150 thumbnail and prediction metadata are stored. Confidence is a percentage from 0 to 100, not a guarantee of correctness. No held-out accuracy report or dataset is included; predictions require independent evaluation. The bundled generic YOLO `.pt` files are not used by the current detector.

Unavailable AI returns an error. The application never substitutes random, filename-based, or heuristic species predictions.

## Requirements

- Node.js 22.12+ (Node 24 recommended) and npm.
- Python 3.11 or 3.12, with a virtual environment.
- MongoDB 7, locally installed or in a container.
- Roboflow access for detection. Classification can run locally without a key.
- A mail provider for production. Local development can write emails to a private outbox.

## Local setup

From the repository root:

```sh
npm ci --prefix backend
npm ci --prefix frontend
python -m venv ai-service/venv
# Linux/macOS:
. ai-service/venv/bin/activate
# PowerShell: ai-service\venv\Scripts\Activate.ps1
python -m pip install -r ai-service/requirements.txt
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
```

Set a long random `JWT_SECRET` in `backend/.env`. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Set the Roboflow variables in `ai-service/.env`; do not commit credentials.

Start MongoDB (or use your own instance and update `MONGODB_URI`):

```sh
docker run -d --name leafscan-mongodb -p 127.0.0.1:27017:27017 -v leafscan_mongodb_data:/data/db mongo:7
```

Run each service in its own terminal, from the indicated directory:

```sh
cd ai-service
venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```sh
cd backend
npm run dev
```

```sh
cd frontend
npm run dev
```

On Windows, use `venv\Scripts\python -m uvicorn ...`. The existing `run-all.bat` and `run-all.ps1` launch services after dependencies, configuration, and MongoDB are prepared.

The frontend uses Vite's `/api` proxy to the backend on port 5000. For a separately hosted frontend set `VITE_API_URL` to the backend's complete API base URL, including `/api`, **before building**.

### Development email and first login

`MAIL_MODE=local` saves messages under `backend/.local/mail/`; read the latest JSON file locally to obtain your verification code or reset link. These files contain sensitive login information, are ignored by Git, and must not be exposed publicly. Local mail mode is disabled in production. To send real mail configure Resend, Brevo, or SMTP as described in `backend/.env.example`.

Register, read the local verification message, and verify the code. Promote an existing account with:

```sh
cd backend
npm run make-admin -- your-account@example.com
```

## Checks

```sh
npm test --prefix backend -- --runInBand
npm run build --prefix frontend
npm run lint --prefix frontend
cd ai-service
venv/bin/python -m unittest discover -s tests -v
```

Readiness requests: backend `GET /api/health`, AI `GET /health`. AI health returns **503 degraded** when detection is unconfigured, while `/classify` remains available with the included checkpoint. A configured detector means configuration is loaded, not that Roboflow authorization or model quality has been verified.

For a live detector check, run `python test_detector.py ../test_leaf.png` from `ai-service` with the virtual environment active. `test_workflow.py` prints raw workflow output for troubleshooting. These commands require credentials and remote access; the automated tests use controlled detector responses.

## API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register`, `/login` | Start signup or login verification |
| `POST /api/auth/verify-code`, `/resend-code` | Complete or resend verification |
| `GET /api/auth/me` | Current authenticated account |
| `POST /api/auth/forgot-password`, `/reset-password` | Recover password |
| `POST /api/auth/deactivate`, `/reactivate` | Pause or restore an account |
| `POST /api/predict` | Authenticated multipart upload, field `image` |
| `GET /api/history`, `/api/history/report` | History and CSV export |
| `GET /api/history/:id/thumbnail` | Owner's thumbnail |
| `GET /api/admin/users`, `/logs`, `/stats` | Administrator views |
| `DELETE /api/admin/users/:id` | Delete a non-admin account |
| `POST /detect`, `/classify` (AI service) | Multipart inference, field `file` |

Protected backend routes require `Authorization: Bearer <token>`. Uploads accept JPEG/PNG up to 5 MB. Zero or multiple detected leaves return 422; unavailable inference returns 503; malformed AI results return 502. FastAPI exposes its schema at `/docs`.

## Deploy on Render

Use the root `render.yaml` Blueprint to create the AI, backend, and frontend services. See [the Render deployment guide](docs/RENDER.md) for required credentials, Atlas networking, and verification. The AI service selects a paid standard instance; review pricing before applying.

## Containers

Create a root `.env` containing `JWT_SECRET`, Roboflow settings, and your mail provider settings, then run `docker compose up --build`. The frontend serves on port 3000, backend on 5000, and AI on 8000. Compose preserves MongoDB in a named volume. Keep database and AI ports private when deploying. Container builds are separate from the native development checks and must be validated on your deployment platform. On managed networks, supply the platform's proxy and CA trust to networked builds; never disable TLS verification.

## Training

Prepare `train`, `valid`, and `test` folders, each containing identical species directories, then run:

```sh
cd ai-service
venv/bin/python train.py --dataset /path/to/dataset --epochs 10 --batch-size 32
```

Training downloads ImageNet MobileNetV2 weights and writes the best validation checkpoint to `models/leaf_classifier.pth`. Back up any checkpoint before replacing it. Dataset splitting is available in `split_dataset.py`; inspect its paths before running it.

## Layout

- `frontend/`: React pages, auth context, upload and history UI.
- `backend/`: Express routes, MongoDB models, authentication, image pipeline.
- `ai-service/`: FastAPI routes, Roboflow adapter, MobileNetV2 classifier, training tools.
- `Leaf_Detection_System_Implementation_Plan.md`: original design proposal; runtime behavior is documented here.

## Project credits

Faculty guide: Prof. Jaidhar C.D. Team: Shashank Gupta (241IT073), Manashvi Prajapati (241IT042), and Maitreya Kulkarni (241IT041).
