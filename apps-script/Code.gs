/** Bookmark Manager API — deploy as an Apps Script API Executable. */
const BOOKMARK_HEADERS = [
  'id', 'categoryId', 'title', 'description', 'tags', 'mainUrl',
  'url1', 'url2', 'url3', 'url4', 'url5', 'faviconUrl', 'ogImageUrl',
  'metadataJson', 'photoUrl', 'createdAt', 'updatedAt', 'owner',
  'favorite', 'pinned', 'notes', 'archivedAt', 'deletedAt', 'deletedFromCategoryId'
];
const CATEGORY_HEADERS = ['id', 'name', 'sheetName', 'sortOrder', 'active'];

function api(request) {
  try {
    return { ok: true, data: apiData_(request) };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function apiData_(request) {
  request = request || {};
  const user = authorize_(request.token);
  const payload = request.payload || {};
  switch (request.operation) {
    case 'bootstrap': return { user: user, categories: listCategories_(), bookmarks: listBookmarks_() };
    case 'getSettings': return { sheetUrl: 'https://docs.google.com/spreadsheets/d/' + getSpreadsheet_().getId() + '/edit' };
    case 'listBookmarks': return listBookmarks_();
    case 'getBookmark': return getBookmark_(payload.id);
    case 'saveBookmark': return saveBookmark_(payload.bookmark, user.email);
    case 'deleteBookmark':
    case 'trashBookmark': return trashBookmark_(payload.id);
    case 'restoreBookmark': return restoreBookmark_(payload.id);
    case 'permanentlyDelete': return permanentlyDelete_(payload.id);
    case 'moveBookmark': return moveBookmark_(payload.id, payload.categoryId);
    case 'toggleCuration': return toggleCuration_(payload.id, payload.field, payload.value);
    case 'bulkUpdate': return bulkUpdate_(payload);
    case 'findDuplicates': return findDuplicates_(payload.url, payload.excludeId);
    case 'mergeBookmarks': return mergeBookmarks_(payload.primaryId, payload.duplicateId);
    case 'listCategories': return listCategories_();
    case 'saveCategory': return saveCategory_(payload.category);
    case 'deleteCategory': return deleteCategory_(payload.id);
    case 'fetchMetadata': return fetchMetadata_(payload.url);
    case 'uploadPhoto': return uploadPhoto_(payload);
    default: throw new Error('Unknown operation: ' + request.operation);
  }
}

function authorize_(token) {
  if (!token) throw new Error('Sign in is required.');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Your Google session has expired. Please sign in again.');
  const info = JSON.parse(response.getContentText());
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_OAUTH_CLIENT_ID');
  const allowed = (props.getProperty('ALLOWED_EMAILS') || '').split(',').map(function (item) { return item.trim().toLowerCase(); }).filter(String);
  if (clientId && info.aud !== clientId) throw new Error('This token belongs to a different OAuth client.');
  if (!info.email || (allowed.length && allowed.indexOf(info.email.toLowerCase()) === -1)) throw new Error('This Google account is not approved for this bookmark library.');
  return { email: info.email, name: info.name || info.email, picture: info.picture || '' };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Missing SHEET_ID Script Property.');
  return SpreadsheetApp.openById(id);
}
function getCategoriesSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName('Categories');
  if (!sheet) sheet = ss.insertSheet('Categories');
  ensureHeaders_(sheet, CATEGORY_HEADERS);
  return sheet;
}
function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  if (!current[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const missing = headers.filter(function (header) { return current.indexOf(header) === -1; });
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  sheet.setFrozenRows(1);
}
function categoryRows_() {
  const sheet = getCategoriesSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, CATEGORY_HEADERS.length).getValues().map(function (row) {
    return { id: String(row[0]), name: String(row[1]), sheetName: String(row[2]), sortOrder: Number(row[3]) || 0, active: row[4] !== false && String(row[4]).toLowerCase() !== 'false' };
  });
}
function listCategories_() { return categoryRows_().filter(function (c) { return c.active; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; }); }
function categoryById_(id) {
  const found = categoryRows_().filter(function (c) { return c.id === id; })[0];
  if (!found) throw new Error('Category not found.');
  return found;
}
function categorySheet_(category) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(category.sheetName);
  if (!sheet) sheet = ss.insertSheet(category.sheetName);
  ensureHeaders_(sheet, BOOKMARK_HEADERS);
  return sheet;
}
function makeId_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }
function bool_(value) { return value === true || String(value).toLowerCase() === 'true'; }
function asText_(value) { return value === null || value === undefined ? '' : String(value); }
function parseTags_(value) {
  if (Array.isArray(value)) return value.map(function (tag) { return asText_(tag).trim().toLowerCase(); }).filter(String);
  return asText_(value).split(',').map(function (tag) { return tag.trim().toLowerCase(); }).filter(String);
}
function unique_(items) { return items.filter(function (value, index, all) { return value && all.indexOf(value) === index; }); }
function rowToBookmark_(row) {
  return {
    id: asText_(row[0]), categoryId: asText_(row[1]), title: asText_(row[2]), description: asText_(row[3]), tags: parseTags_(row[4]), mainUrl: asText_(row[5]),
    additionalUrls: [asText_(row[6]), asText_(row[7]), asText_(row[8]), asText_(row[9]), asText_(row[10])],
    faviconUrl: asText_(row[11]), ogImageUrl: asText_(row[12]), metadata: asText_(row[13]), photoUrl: asText_(row[14]), createdAt: asText_(row[15]), updatedAt: asText_(row[16]), owner: asText_(row[17]),
    favorite: bool_(row[18]), pinned: bool_(row[19]), notes: asText_(row[20]), archivedAt: asText_(row[21]), deletedAt: asText_(row[22]), deletedFromCategoryId: asText_(row[23])
  };
}
function bookmarkRow_(bookmark) {
  const urls = (bookmark.additionalUrls || []).concat(['', '', '', '', '']).slice(0, 5);
  return [bookmark.id, bookmark.categoryId, bookmark.title, bookmark.description, unique_(parseTags_(bookmark.tags)).join(', '), bookmark.mainUrl,
    urls[0], urls[1], urls[2], urls[3], urls[4], bookmark.faviconUrl || '', bookmark.ogImageUrl || '', bookmark.metadata || '', bookmark.photoUrl || '',
    bookmark.createdAt || '', bookmark.updatedAt || '', bookmark.owner || '', !!bookmark.favorite, false, bookmark.notes || '', bookmark.archivedAt || '', bookmark.deletedAt || '', bookmark.deletedFromCategoryId || ''];
}
function listBookmarks_() {
  const results = [];
  categoryRows_().forEach(function (category) {
    const sheet = categorySheet_(category);
    if (sheet.getLastRow() < 2) return;
    sheet.getRange(2, 1, sheet.getLastRow() - 1, BOOKMARK_HEADERS.length).getValues().forEach(function (row) { if (row[0]) results.push(rowToBookmark_(row)); });
  });
  return results;
}
function locateBookmark_(id) {
  const categories = categoryRows_();
  for (let i = 0; i < categories.length; i++) {
    const sheet = categorySheet_(categories[i]);
    if (sheet.getLastRow() < 2) continue;
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(id);
    if (index !== -1) return { sheet: sheet, row: index + 2, bookmark: rowToBookmark_(sheet.getRange(index + 2, 1, 1, BOOKMARK_HEADERS.length).getValues()[0]) };
  }
  throw new Error('Bookmark not found.');
}
function getBookmark_(id) { return locateBookmark_(id).bookmark; }
function validateBookmark_(bookmark) {
  if (!bookmark.categoryId || !bookmark.title || !bookmark.mainUrl) throw new Error('Category, title and main URL are required.');
  try { const parsed = new URL(bookmark.mainUrl); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch (error) { throw new Error('Enter a valid http(s) main URL.'); }
}
function writeBookmark_(located, bookmark) {
  const target = categorySheet_(categoryById_(bookmark.categoryId));
  if (located && located.sheet.getSheetId() !== target.getSheetId()) {
    located.sheet.deleteRow(located.row);
    target.appendRow(bookmarkRow_(bookmark));
  } else if (located) {
    located.sheet.getRange(located.row, 1, 1, BOOKMARK_HEADERS.length).setValues([bookmarkRow_(bookmark)]);
  } else target.appendRow(bookmarkRow_(bookmark));
  return bookmark;
}
function saveBookmark_(input, owner) {
  const bookmark = input || {};
  validateBookmark_(bookmark);
  let located = null;
  if (bookmark.id) located = locateBookmark_(bookmark.id);
  bookmark.id = bookmark.id || makeId_();
  bookmark.tags = unique_(parseTags_(bookmark.tags));
  bookmark.additionalUrls = (bookmark.additionalUrls || []).concat(['', '', '', '', '']).slice(0, 5);
  bookmark.createdAt = bookmark.createdAt || (located && located.bookmark.createdAt) || now_();
  bookmark.updatedAt = now_();
  bookmark.owner = bookmark.owner || (located && located.bookmark.owner) || owner;
  bookmark.favorite = !!bookmark.favorite;
  bookmark.notes = bookmark.notes || ''; bookmark.archivedAt = bookmark.archivedAt || ''; bookmark.deletedAt = bookmark.deletedAt || ''; bookmark.deletedFromCategoryId = bookmark.deletedFromCategoryId || '';
  return writeBookmark_(located, bookmark);
}
function updateLocated_(located, bookmark) { bookmark.updatedAt = now_(); return writeBookmark_(located, bookmark); }
function trashBookmark_(id) { const located = locateBookmark_(id); located.bookmark.deletedAt = now_(); located.bookmark.deletedFromCategoryId = located.bookmark.categoryId; return updateLocated_(located, located.bookmark); }
function restoreBookmark_(id) { const located = locateBookmark_(id); located.bookmark.deletedAt = ''; located.bookmark.categoryId = located.bookmark.deletedFromCategoryId || located.bookmark.categoryId; located.bookmark.deletedFromCategoryId = ''; return updateLocated_(located, located.bookmark); }
function permanentlyDelete_(id) { const located = locateBookmark_(id); if (!located.bookmark.deletedAt) throw new Error('Only bookmarks in trash can be permanently deleted.'); located.sheet.deleteRow(located.row); return { id: id, deleted: true }; }
function moveBookmark_(id, categoryId) { const located = locateBookmark_(id); categoryById_(categoryId); located.bookmark.categoryId = categoryId; return updateLocated_(located, located.bookmark); }
function toggleCuration_(id, field, value) { if (field !== 'favorite') throw new Error('Invalid curation field.'); const located = locateBookmark_(id); located.bookmark.favorite = !!value; return updateLocated_(located, located.bookmark); }
function bulkUpdate_(payload) {
  const ids = (payload.ids || []).filter(Boolean); if (!ids.length) throw new Error('Select at least one bookmark.');
  const action = payload.action; const results = [];
  ids.forEach(function (id) {
    const located = locateBookmark_(id); const b = located.bookmark;
    if (action === 'move') { categoryById_(payload.categoryId); b.categoryId = payload.categoryId; }
    else if (action === 'addTag') b.tags = unique_(b.tags.concat(parseTags_(payload.tag)));
    else if (action === 'removeTag') b.tags = b.tags.filter(function (tag) { return parseTags_(payload.tag).indexOf(tag) === -1; });
    else if (action === 'trash') { b.deletedAt = now_(); b.deletedFromCategoryId = b.categoryId; }
    else if (action === 'restoreTrash') { b.deletedAt = ''; b.categoryId = b.deletedFromCategoryId || b.categoryId; b.deletedFromCategoryId = ''; }
    else throw new Error('Unsupported bulk action.');
    results.push(updateLocated_(located, b));
  });
  return results;
}
function normalizeUrl_(value) {
  try { const u = new URL(value); return (u.hostname.toLowerCase().replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + u.search).replace(/\/$/, ''); } catch (error) { return asText_(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''); }
}
function findDuplicates_(url, excludeId) { const target = normalizeUrl_(url); if (!target) return []; return listBookmarks_().filter(function (b) { return !b.deletedAt && b.id !== excludeId && normalizeUrl_(b.mainUrl) === target; }); }
function mergeBookmarks_(primaryId, duplicateId) {
  if (!primaryId || !duplicateId || primaryId === duplicateId) throw new Error('Choose two different bookmarks to merge.');
  const primaryLocated = locateBookmark_(primaryId), duplicateLocated = locateBookmark_(duplicateId);
  const primary = primaryLocated.bookmark, duplicate = duplicateLocated.bookmark;
  if (primary.deletedAt || duplicate.deletedAt) throw new Error('Only active bookmarks can be merged.');
  primary.tags = unique_(primary.tags.concat(duplicate.tags));
  primary.additionalUrls = unique_(primary.additionalUrls.concat(duplicate.additionalUrls).filter(Boolean)).slice(0, 5); while (primary.additionalUrls.length < 5) primary.additionalUrls.push('');
  primary.notes = [primary.notes, duplicate.notes].filter(Boolean).join(primary.notes && duplicate.notes ? '\n\n' : '');
  ['title', 'description', 'faviconUrl', 'ogImageUrl', 'metadata', 'photoUrl'].forEach(function (field) { if (!primary[field] && duplicate[field]) primary[field] = duplicate[field]; });
  primary.favorite = primary.favorite || duplicate.favorite;
  duplicate.deletedAt = now_(); duplicate.deletedFromCategoryId = duplicate.categoryId;
  updateLocated_(duplicateLocated, duplicate);
  return updateLocated_(primaryLocated, primary);
}
function saveCategory_(input) {
  const category = input || {}; const sheet = getCategoriesSheet_(); const rows = categoryRows_();
  if (!category.name || !asText_(category.name).trim()) throw new Error('Category name is required.');
  if (category.id) {
    const index = rows.map(function (row) { return row.id; }).indexOf(category.id); if (index === -1) throw new Error('Category not found.');
    const old = rows[index]; const next = { id: old.id, name: asText_(category.name).trim(), sheetName: old.sheetName, sortOrder: Number(category.sortOrder) || old.sortOrder, active: category.active !== false };
    sheet.getRange(index + 2, 1, 1, CATEGORY_HEADERS.length).setValues([[next.id, next.name, next.sheetName, next.sortOrder, next.active]]); return next;
  }
  const safeName = asText_(category.name).trim().replace(/[\\/:?*\[\]]/g, '-').slice(0, 80);
  const existingNames = rows.map(function (row) { return row.sheetName; }); let sheetName = safeName || 'Category', suffix = 2; while (existingNames.indexOf(sheetName) !== -1 || getSpreadsheet_().getSheetByName(sheetName)) sheetName = (safeName || 'Category') + ' ' + suffix++;
  const next = { id: makeId_(), name: asText_(category.name).trim(), sheetName: sheetName, sortOrder: rows.length ? Math.max.apply(null, rows.map(function (row) { return row.sortOrder; })) + 1 : 0, active: true };
  sheet.appendRow([next.id, next.name, next.sheetName, next.sortOrder, next.active]); categorySheet_(next); return next;
}
function deleteCategory_(id) { const rows = categoryRows_(); const index = rows.map(function (row) { return row.id; }).indexOf(id); if (index === -1) throw new Error('Category not found.'); getCategoriesSheet_().getRange(index + 2, 5).setValue(false); return { id: id, deleted: true }; }
function fetchMetadata_(url) {
  try {
    const response = UrlFetchApp.fetch(url, { followRedirects: true, muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0 BookmarkManager/1.0' } });
    if (response.getResponseCode() >= 400) throw new Error('The website returned HTTP ' + response.getResponseCode());
    const html = response.getContentText(); const finalUrl = response.getFinalUrl ? response.getFinalUrl() : url;
    function meta_(property) { const r = new RegExp('<meta[^>]+(?:property|name)=["\']' + property.replace(':', '\\:') + '["\'][^>]+content=["\']([^"\']*)', 'i').exec(html) || new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + property.replace(':', '\\:') + '["\']', 'i').exec(html); return r ? r[1] : ''; }
    function absolute_(value) { try { return value ? new URL(value, finalUrl).toString() : ''; } catch (e) { return ''; } }
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = meta_('og:title') || (titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '');
    const description = meta_('og:description') || meta_('description') || '';
    const iconMatch = /<link[^>]+rel=["\'][^"\']*(?:icon|shortcut icon)[^"\']*["\'][^>]+href=["\']([^"\']+)/i.exec(html) || /<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\'][^"\']*(?:icon|shortcut icon)/i.exec(html);
    const parsed = new URL(finalUrl);
    return { title: title, description: description, faviconUrl: absolute_(iconMatch ? iconMatch[1] : '/favicon.ico') || parsed.origin + '/favicon.ico', ogImageUrl: absolute_(meta_('og:image')), metadata: JSON.stringify({ url: finalUrl, siteName: meta_('og:site_name'), type: meta_('og:type') }) };
  } catch (error) { return { warning: error.message || 'Metadata could not be fetched.' }; }
}
function uploadPhoto_(payload) {
  if (!payload || !payload.dataUrl) throw new Error('Photo data is required.');
  const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'); if (!folderId) throw new Error('Missing DRIVE_FOLDER_ID Script Property.');
  const match = /^data:([^;]+);base64,(.+)$/.exec(payload.dataUrl); if (!match) throw new Error('Invalid photo data.');
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], payload.fileName || ('bookmark-' + Date.now() + '.webp'));
  const file = DriveApp.getFolderById(folderId).createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: 'https://drive.google.com/uc?export=view&id=' + file.getId(), id: file.getId() };
}
