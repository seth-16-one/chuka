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
EMAIL_PROVIDER=smtp
EMAIL_FROM_NAME=Chuka University App
EMAIL_FROM_ADDRESS=no-reply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-gmail-app-password
RESEND_API_KEY=
OTP_COOLDOWN_SECONDS=60
OTP_EXPIRY_MINUTES=10
```

OTP emails can be sent through Gmail SMTP or Resend. If you use Gmail, set an app password and keep `EMAIL_PROVIDER=smtp`.

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
