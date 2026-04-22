# Chuka Backend API

This folder is a standalone backend project. Deploy it separately from the Expo app and point the app's `EXPO_PUBLIC_API_URL` to the deployed backend URL.

For Deno Deploy, use [`backend/main.ts`](./main.ts) as the entrypoint.

## Environment

Set these variables in Deno Deploy:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_URL=https://your-deployed-backend-url
PORT=8000
```

For OTP emails, configure your Supabase Auth email templates to use `{{ .Token }}` instead of `{{ .ConfirmationURL }}` so users receive a code they can enter in the app.

## Local Run

```bash
cd backend
deno task dev
```

## Routes

- `GET /`
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/otp`
- `POST /api/auth/verify`
- `POST /api/auth/reset`
- `POST /api/auth/register`
- `POST /api/auth/password`
- `GET /api/data`
- `GET /api/data/:table`
- `GET /api/data/:table/:id`
- `POST /api/data/:table`
- `PATCH /api/data/:table/:id`
- `DELETE /api/data/:table/:id`
