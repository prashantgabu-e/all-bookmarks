# Violet Bookmarks Features

## Secure access

- Uses Google Identity Services for sign-in.
- The Apps Script service validates the Google access token, verifies its OAuth client ID, and restricts the application to the comma-separated email allowlist stored in Script Properties.
- Firebase is not used.

## Bookmark library

- Browse the complete collection or a single category.
- Search title, description, and tags; filter by tag.
- Create, edit, recoverably delete, restore, and move bookmarks across categories.
- A bookmark contains a category, title, description, normalized tags, one main URL, and five optional additional URLs.
- Every URL field has a copy control. Bookmark cards open the main URL in a new tab.
- Additional URLs are collapsed for new bookmarks and automatically expanded while editing a populated bookmark.
- Star bookmarks, keep private notes, and filter active, starred, or trash views.
- Select multiple cards to move them, add/remove tags, restore from trash, or move them to trash. Permanent deletion is available only in trash.
- Matching normalized main URLs are detected before saving. You can save separately or merge into a chosen existing bookmark; a merge combines tags, notes, and optional URLs and moves the duplicate to trash.

## Metadata and images

- Metadata refresh retrieves the page title, description, favicon, Open Graph image, site name, and canonical URL through Apps Script.
- The card visual prefers the user photo, then favicon, then Open Graph image, then a title initial.
- Metadata errors do not prevent saving a manually entered bookmark.
- Optional images are resized in the browser to a maximum dimension of 1200px and compressed as WebP with a 500 KB target before upload to Google Drive.

## Category management

- Create categories from Settings.
- Each active category has its own Google Sheets tab and a corresponding record in the `Categories` tab.
- Removing a category hides it from the application but preserves its sheet and bookmarks.

## Experience

- Mobile-first layout with a bottom navigation bar and responsive bookmark grid.
- Violet-accented interface, animated cards and dialogs, loading states, and feedback notices.
- Light and dark themes. The first visit follows the device preference; a user choice is stored locally as `violet-theme`.
- Existing category sheets are migrated safely: missing library columns are appended without changing stored rows.

## Hosting

- The Vite build is output to `docs/`, ready for GitHub Pages.
- Environment values are supplied at build time through `VITE_GOOGLE_CLIENT_ID` and `VITE_APPS_SCRIPT_URL`.
