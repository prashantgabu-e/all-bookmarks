const CATEGORY_SHEET = 'Categories';
const CATEGORY_HEADERS = ['id', 'name', 'sheetName', 'sortOrder', 'active'];
const BOOKMARK_HEADERS = ['id', 'categoryId', 'title', 'description', 'tags', 'mainUrl', 'url1', 'url2', 'url3', 'url4', 'url5', 'faviconUrl', 'ogImageUrl', 'metadataJson', 'photoUrl', 'createdAt', 'updatedAt', 'owner'];

function doGet() { return HtmlService.createHtmlOutputFromFile('Bridge').setTitle('Violet Bookmarks service').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }
function api(request) {
  try {
    const user = authorize_(request.token); const p = request.payload || {}; let data;
    switch (request.operation) {
      case 'bootstrap': data = { categories: categories_(), bookmarks: listBookmarks_() }; break;
      case 'listBookmarks': data = listBookmarks_(); break;
      case 'getBookmark': data = findBookmark_(p.id); break;
      case 'saveBookmark': data = saveBookmark_(p.bookmark, user); break;
      case 'deleteBookmark': data = deleteBookmark_(p.id); break;
      case 'moveBookmark': data = moveBookmark_(p.id, p.categoryId, user); break;
      case 'listCategories': data = categories_(); break;
      case 'saveCategory': data = saveCategory_(p.category); break;
      case 'deleteCategory': data = deleteCategory_(p.id); break;
      case 'fetchMetadata': data = fetchMetadata_(p.url); break;
      case 'uploadPhoto': data = uploadPhoto_(p.image, p.name); break;
      default: throw new Error('Unsupported operation.');
    }
    return { ok: true, data: data };
  } catch (err) { return { ok: false, error: err.message || String(err) }; }
}

function props_() { const p = PropertiesService.getScriptProperties().getProperties(); ['SPREADSHEET_ID', 'DRIVE_FOLDER_ID', 'GOOGLE_CLIENT_ID', 'ALLOWED_EMAILS'].forEach(k => { if (!p[k]) throw new Error('Server configuration is incomplete: ' + k); }); return p; }
function authorize_(token) {
  if (!token) throw new Error('Sign-in token required.'); const p = props_();
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Google sign-in token is invalid or expired.'); const claim = JSON.parse(res.getContentText());
  if (claim.aud !== p.GOOGLE_CLIENT_ID || claim.email_verified !== 'true') throw new Error('Google sign-in could not be verified.');
  const allow = p.ALLOWED_EMAILS.split(',').map(x => x.trim().toLowerCase()); if (!allow.includes(String(claim.email).toLowerCase())) throw new Error('This Google account is not authorized.'); return claim.email;
}
function ss_() { return SpreadsheetApp.openById(props_().SPREADSHEET_ID); }
function categories_() { const ss = ss_(); let sh = ss.getSheetByName(CATEGORY_SHEET); if (!sh) { sh = ss.insertSheet(CATEGORY_SHEET); sh.getRange(1, 1, 1, CATEGORY_HEADERS.length).setValues([CATEGORY_HEADERS]).setFontWeight('bold'); sh.setFrozenRows(1); return []; } const rows = sh.getDataRange().getValues().slice(1); return rows.filter(r => r[0] && r[4] !== false).map(r => ({ id: r[0], name: r[1], sheetName: r[2], sortOrder: Number(r[3]), active: r[4] !== false })).sort((a,b) => a.sortOrder-b.sortOrder); }
function safeSheetName_(value) { return value.replace(/[\\/?*\[\]:]/g, '-').trim().slice(0, 90) || 'Category'; }
function uniqueSheetName_(name, ignore) { const ss = ss_(); let proposed = safeSheetName_(name), n = 2; while (ss.getSheetByName(proposed) && proposed !== ignore) proposed = safeSheetName_(name) + ' ' + n++; return proposed; }
function saveCategory_(input) { if (!input || !String(input.name || '').trim()) throw new Error('Category name is required.'); const ss = ss_(); let sh = ss.getSheetByName(CATEGORY_SHEET); if (!sh) categories_(), sh = ss.getSheetByName(CATEGORY_SHEET); const existing = categories_().find(c => c.id === input.id); const name = String(input.name).trim(); if (existing) { const sheetName = name === existing.name ? existing.sheetName : uniqueSheetName_(name, existing.sheetName); if (sheetName !== existing.sheetName) ss.getSheetByName(existing.sheetName).setName(sheetName); const row = findRow_(sh, existing.id); sh.getRange(row, 1, 1, 5).setValues([[existing.id, name, sheetName, existing.sortOrder, true]]); return { id: existing.id, name, sheetName, sortOrder: existing.sortOrder, active: true }; } const category = { id: Utilities.getUuid(), name, sheetName: uniqueSheetName_(name), sortOrder: categories_().length, active: true }; const tab = ss.insertSheet(category.sheetName); tab.getRange(1,1,1,BOOKMARK_HEADERS.length).setValues([BOOKMARK_HEADERS]).setFontWeight('bold'); tab.setFrozenRows(1); sh.appendRow([category.id, category.name, category.sheetName, category.sortOrder, true]); return category; }
function deleteCategory_(id) { const sh = ss_().getSheetByName(CATEGORY_SHEET); const row = findRow_(sh, id); if (!row) throw new Error('Category not found.'); sh.getRange(row, 5).setValue(false); return true; }
function listBookmarks_() { return categories_().flatMap(c => { const sh = ss_().getSheetByName(c.sheetName); if (!sh || sh.getLastRow() < 2) return []; return sh.getRange(2, 1, sh.getLastRow()-1, BOOKMARK_HEADERS.length).getValues().filter(r => r[0]).map(rowToBookmark_); }); }
function rowToBookmark_(r) { return { id:r[0], categoryId:r[1], title:r[2], description:r[3], tags: r[4] ? String(r[4]).split(',').filter(Boolean) : [], mainUrl:r[5], additionalUrls:[r[6],r[7],r[8],r[9],r[10]].map(x=>x||''), faviconUrl:r[11]||'', ogImageUrl:r[12]||'', metadata: parseJson_(r[13]), photoUrl:r[14]||'', createdAt:r[15]||'', updatedAt:r[16]||'', owner:r[17]||'' }; }
function bookmarkRow_(b) { const urls = (b.additionalUrls || []).concat(['','','','','']).slice(0,5); return [b.id,b.categoryId,b.title,b.description,(b.tags||[]).join(','),b.mainUrl].concat(urls,[b.faviconUrl||'',b.ogImageUrl||'',JSON.stringify(b.metadata||{}),b.photoUrl||'',b.createdAt,b.updatedAt,b.owner]); }
function findBookmark_(id) { return listBookmarks_().find(b => b.id === id) || null; }
function saveBookmark_(b, owner) { if (!b || !b.categoryId || !String(b.title||'').trim() || !/^https?:\/\//i.test(b.mainUrl||'')) throw new Error('Category, title, and a valid main URL are required.'); const category = categories_().find(c => c.id === b.categoryId); if (!category) throw new Error('Selected category no longer exists.'); const old = b.id ? locateBookmark_(b.id) : null; const now = new Date().toISOString(); const result = Object.assign({}, old ? old.bookmark : {}, b, { id: b.id || Utilities.getUuid(), title: String(b.title).trim(), createdAt: old ? old.bookmark.createdAt : now, updatedAt: now, owner: old ? old.bookmark.owner : owner }); if (old && old.category.sheetName !== category.sheetName) old.sheet.deleteRow(old.row); const target = ss_().getSheetByName(category.sheetName); const row = old && old.category.sheetName === category.sheetName ? old.row : target.getLastRow()+1; target.getRange(row,1,1,BOOKMARK_HEADERS.length).setValues([bookmarkRow_(result)]); return result; }
function locateBookmark_(id) { for (const category of categories_()) { const sh = ss_().getSheetByName(category.sheetName); if (!sh || sh.getLastRow() < 2) continue; const ids = sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat(); const index = ids.indexOf(id); if (index >= 0) return { sheet:sh, row:index+2, category, bookmark:rowToBookmark_(sh.getRange(index+2,1,1,BOOKMARK_HEADERS.length).getValues()[0]) }; } return null; }
function deleteBookmark_(id) { const found = locateBookmark_(id); if (!found) throw new Error('Bookmark not found.'); found.sheet.deleteRow(found.row); return true; }
function moveBookmark_(id, categoryId, owner) { const b = findBookmark_(id); if (!b) throw new Error('Bookmark not found.'); b.categoryId = categoryId; return saveBookmark_(b, owner); }
function findRow_(sheet, id) { if (!sheet || sheet.getLastRow() < 2) return 0; const pos = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().flat().indexOf(id); return pos < 0 ? 0 : pos + 2; }
function parseJson_(value) { try { return value ? JSON.parse(value) : {}; } catch (_) { return {}; } }
function fetchMetadata_(url) { if (!/^https?:\/\//i.test(url || '')) throw new Error('Enter a valid http(s) URL.'); try { const response = UrlFetchApp.fetch(url, { followRedirects:true, muteHttpExceptions:true, headers:{'User-Agent':'Mozilla/5.0 VioletBookmarks/1.0'} }); if (response.getResponseCode() >= 400) return { warning:'Website could not be reached (' + response.getResponseCode() + ').' }; const html = response.getContentText().slice(0, 800000); const title = meta_(html, 'og:title') || tag_(html, 'title') || ''; const description = meta_(html, 'og:description') || meta_(html, 'description') || ''; const ogImageUrl = absolute_(meta_(html, 'og:image') || '', url); const icon = link_(html, 'icon') || link_(html, 'shortcut icon') || '/favicon.ico'; return { title, description, faviconUrl:absolute_(icon,url), ogImageUrl, metadata:{ siteName:meta_(html,'og:site_name') || '', canonical:link_(html,'canonical') || '' } }; } catch (err) { return { warning:'Metadata could not be fetched: ' + err.message }; } }
function meta_(html, name) { const a = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']+)", 'i'); const b = new RegExp("<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" + name + "[\"']", 'i'); const m = html.match(a)||html.match(b); return m ? decodeEntities_(m[1]) : ''; }
function tag_(html, name) { const m=html.match(new RegExp('<'+name+'[^>]*>([\\s\\S]*?)</'+name+'>','i')); return m ? decodeEntities_(m[1].replace(/<[^>]+>/g,'').trim()) : ''; }
function link_(html, rel) { const m=html.match(new RegExp("<link[^>]+rel=[\"'][^\"']*" + rel + "[^\"']*[\"'][^>]+href=[\"']([^\"']+)", 'i')) || html.match(new RegExp("<link[^>]+href=[\"']([^\"']+)[\"'][^>]+rel=[\"'][^\"']*" + rel, 'i')); return m ? m[1] : ''; }
function absolute_(value, base) { if (!value) return ''; if (/^https?:/i.test(value)) return value; if (value.indexOf('//')===0) return 'https:'+value; const m=base.match(/^(https?:\/\/[^/]+)/i); return value[0]==='/' ? m[1]+value : base.replace(/\/[^/]*$/,'/')+value; }
function decodeEntities_(s) { return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); }
function uploadPhoto_(dataUrl, name) { if (!/^data:image\/webp;base64,/.test(dataUrl||'')) throw new Error('Upload must be optimized WebP data.'); const bytes = Utilities.base64Decode(dataUrl.split(',')[1]); const blob = Utilities.newBlob(bytes, 'image/webp', name || 'bookmark.webp'); const file = DriveApp.getFolderById(props_().DRIVE_FOLDER_ID).createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return 'https://drive.google.com/uc?export=view&id=' + file.getId(); }
