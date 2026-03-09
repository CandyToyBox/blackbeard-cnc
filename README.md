# Blackbeard CNC Site v1

Two-page Vercel-ready website with:
- Home page + gallery/request page
- Email-only quote/work-order form with file attachments
- Password-protected admin photo manager backed by Vercel Blob

## Local Files
- `index.html` home page
- `gallery.html` gallery + intake form
- `admin.html` admin photo manager
- `site.css` shared visual theme
- `gallery.js` gallery loading + form submission
- `admin.js` admin auth + photo CRUD UI

## API Routes
- `POST /api/submit-request` form submission (multipart)
- `POST /api/admin-auth/login` admin login
- `POST /api/admin-auth/logout` admin logout
- `GET /api/admin-photos` public photo list
- `GET /api/admin-photos?admin=1` admin-authenticated list
- `POST /api/admin-photos` upload photo (admin only)
- `PATCH /api/admin-photos/:id` update metadata (admin only)
- `DELETE /api/admin-photos/:id` delete uploaded photo (admin only)

## Environment Variables
Copy `.env.example` and set:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_PASSCODE`
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- Optional: `BB_NOTIFY_EMAIL` (defaults to `blackbeardcnc@outlook.com`)

## Deploy
1. Push this folder to a Vercel project.
2. Add the environment variables in Vercel Project Settings.
3. Deploy.
4. Visit `/admin.html` and login with `ADMIN_PASSCODE` to manage gallery photos.
