# Violet Bookmarks

A mobile-first bookmark manager hosted on GitHub Pages, using Google Sheets, Google Drive, Google Identity Services, and Google Apps Script. Firebase is not used.

## Setup

1. Create a Google OAuth Web client and add your GitHub Pages URL and `http://localhost:5173` to its authorized JavaScript origins.
2. Create a standalone Apps Script project and copy the files from `apps-script/` into it. Set `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `GOOGLE_CLIENT_ID`, `ALLOWED_EMAILS` (comma-separated), and `APP_ORIGIN` in Script Properties.
3. Deploy the script as a web app, executing as you. Use the resulting `/exec` URL in `.env`.
4. Copy `.env.example` to `.env`, fill both values, then run `npm install`, `npm run dev`, and `npm run build`.
5. Configure GitHub Pages to publish the `docs/` directory (or use a GitHub Actions Pages workflow).

The first successful `bootstrap` automatically creates the `Categories` sheet. Use Settings to add your first category.
