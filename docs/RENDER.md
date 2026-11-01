# Deploy LeafScan on Render

The root `render.yaml` provisions the Docker AI service, Node backend, and static frontend.
The AI service selects Render's paid `standard` plan; review current pricing before applying.
The backend selects `free` and can sleep when idle. Static hosting uses Render's static-site plan.

## Required account configuration

Before deploying, create a MongoDB Atlas database user and configure a Resend sender domain.
Have these values ready to enter securely in Render's Blueprint form:

| Service | Variable | Value |
| --- | --- | --- |
| AI | `ROBOFLOW_API_KEY` | Roboflow API key |
| AI | `ROBOFLOW_WORKSPACE` | Workspace containing your workflow |
| AI | `ROBOFLOW_WORKFLOW_ID` | Validated leaf-detection workflow ID |
| Backend | `MONGODB_URI` | Atlas URI with the `leaf_detection` database |
| Backend | `FRONTEND_URL` | Your frontend's final public URL; update after creation |
| Backend | `RESEND_API_KEY` | Resend API key |
| Backend | `RESEND_FROM` | `LeafScan <noreply@your-verified-domain.com>` |

The example Roboflow workflow in older instructions targets siam weed, not general leaves.
No production credentials are included. The local MongoDB URI and local mail outbox are not production services.

## Create the deployment

1. Push the updated repository, including `render.yaml`, to GitHub.
2. In Render choose **New → Blueprint**, connect `arpitkjaiswal/CNN`, and select the branch containing these changes.
3. Review the three services and enter the required values. The Blueprint generates the JWT secret and links the service URLs.
4. Apply the Blueprint. Copy the backend's outbound IP addresses from Render into Atlas's project IP access list. Redeploy the backend if its first database connection failed.
5. Copy the static frontend URL into backend `FRONTEND_URL` and save/redeploy that service.

`VITE_API_ORIGIN` references the backend URL. The frontend build appends `/api` automatically.
Changing that URL requires rebuilding the frontend. The Blueprint includes the SPA rewrite for direct page visits.

## Verify

- Backend `/api/health` must return 200.
- AI `/health` must return 200 with both model flags true. This verifies initialization, not remote workflow authorization.
- Register and verify an account using actual email, then sign in.
- Upload a single leaf and verify a real prediction is saved in history.
- Refresh `/history`, sign out/in, and test password recovery.
- Inspect AI logs and perform a real `/detect` request to validate Roboflow access.

An unavailable detector must return an error; it must not produce a fabricated species.

## Agent deployment access

For an agent to deploy through Render's API, supply a Render API key securely as `RENDER_API_KEY`
in the cloud environment's settings with destination `api.render.com`, then apply the configuration.
Do not paste credentials into chat. The API key authenticates the account; the account must also
have authorized access to this GitHub repository and any paid resources being created.
