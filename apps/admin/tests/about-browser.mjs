// Requires the existing isolated fixture + local Worker; never runs against live services.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base='http://127.0.0.1:3002', fixture='http://127.0.0.1:3003';
const account=JSON.parse(await readFile('/private/tmp/atelier-integration-account.json','utf8'));
const control=body=>fetch(fixture+'/__control',{method:'POST',body:JSON.stringify(body)});
await control({reset:true});
// Reuse an isolated fixture document only. The fixture has no remote access.
await control({patch:{id:'gallery-original',set:{_type:'siteSettings',displayName:'Fixture brand',description:'Preserved description'}}});
const before=(await (await fetch(fixture+'/__state')).json()).documents;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(base+'/login/');
 await page.locator('input').nth(0).fill(account.username);await page.locator('input[type=password]').fill(account.password);await page.locator('.login-submit').click();
 await page.waitForURL(base+'/');await page.goto(base+'/about/');
 await page.getByLabel('כותרת העמוד').fill('הסיפור שלנו');await page.getByLabel('פתיח (לא חובה)').fill('פתיח לבדיקה מקומית');await page.getByLabel('הסיפור שלנו',{exact:true}).fill('פסקה ראשונה\n\nפסקה שנייה');
 await page.getByRole('button',{name:'תצוגה מקדימה',exact:true}).click();await assert.equal(await page.locator('.about-preview p').count(),3);
 await page.getByRole('button',{name:'שמירה ופרסום',exact:true}).click();await page.getByText('התוכן נשמר. האתר יתעדכן לאחר השלמת הפרסום.',{exact:true}).waitFor();
 await page.reload();await assert.equal(await page.getByLabel('כותרת העמוד').inputValue(),'הסיפור שלנו');await assert.equal(await page.getByLabel('הסיפור שלנו',{exact:true}).inputValue(),'פסקה ראשונה\n\nפסקה שנייה');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.screenshot({path:new URL('../../../docs/premium-admin-390.png',import.meta.url).pathname,fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:new URL('../../../docs/premium-admin-1440.png',import.meta.url).pathname,fullPage:true});
 const after=(await (await fetch(fixture+'/__state')).json()).documents;
 assert.deepEqual(after.filter(d=>d._id!=='gallery-original'),before.filter(d=>d._id!=='gallery-original'));
 const settings=after.find(d=>d._id==='gallery-original');assert.equal(settings.displayName,'Fixture brand');assert.equal(settings.description,'Preserved description');assert.equal(settings.aboutBody,'פסקה ראשונה\n\nפסקה שנייה');
 // Owner/CSRF/Origin enforcement on the real new route, using local session only.
 assert.equal((await fetch(base+'/api/about')).status,401);
 const session=JSON.parse(await readFile('/private/tmp/atelier-integration-session.json','utf8'));
 const bad=await fetch(base+'/api/about',{method:'POST',headers:{Cookie:session.cookie,Origin:base,'Content-Type':'application/json','X-CSRF-Token':'invalid'},body:'{}'});assert.equal(bad.status,403);
 console.log('PASS About admin mobile/desktop, local preview, authenticated save/reload, paragraph preservation, unrelated document preservation, anonymous and CSRF rejection');
 await writeFile(new URL('../../../docs/premium-about-browser.json',import.meta.url),JSON.stringify({fixtureOnly:true,viewports:[390,1440],saveReload:true,paragraphs:true,unrelatedDocumentsPreserved:true,anonymous:401,invalidCsrf:403},null,2));
} finally {await browser.close();await control({reset:true});}
