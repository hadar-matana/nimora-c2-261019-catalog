import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const output = new URL('../../../docs/phase-a/', import.meta.url);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const rows=[];
try {
 for (const width of [390,1512]) {
  const context=await browser.newContext({viewport:{width,height:980},reducedMotion:'reduce'});
  const images=new Map();
  await context.route('**/*',async route=>{
   const request=route.request();
   assert.ok(['GET','HEAD'].includes(request.method()),'Visual test must never write');
   if(request.url().startsWith('https://cdn.sanity.io/')){
    if(!images.has(request.url())) images.set(request.url(),await (await route.fetch()).body());
    return route.fulfill({status:200,body:images.get(request.url()),contentType:request.url().includes('.png')?'image/png':'image/jpeg'});
   }
   return route.continue();
  });
  for(const [label,path] of [['home','/'],['about','/about/'],['product','/products/classic-rib-tank/']]) {
   const metrics=[];
   for(const [version,port] of [['approved',3100],['current',3101]]) {
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
    const metric=await page.evaluate(()=>({text:document.body.innerText,width:document.documentElement.scrollWidth,header:document.querySelector('header').getBoundingClientRect().toJSON(),footer:document.querySelector('footer').getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.catalog-card')].map(e=>e.getBoundingClientRect().toJSON())}));
    metrics.push(metric);
    await page.screenshot({path:new URL(`${label}-${width}-${version}.png`,output).pathname,fullPage:true,animations:'disabled'});
    await page.close();
   }
   assert.deepEqual(metrics[1],metrics[0],`${label} at ${width}px must preserve approved content and geometry`);
   assert.equal(metrics[1].width,width);
   rows.push({page:label,width,contentAndGeometryEqual:true});
  }
  const page=await context.newPage();await page.goto('http://127.0.0.1:3101/');
  const all=await page.locator('.catalog-card').count();const filters=page.locator('[aria-pressed]');await filters.nth(1).click();assert.ok(await page.locator('.catalog-card').count()<all);await filters.first().click();assert.equal(await page.locator('.catalog-card').count(),all);
  await page.goto('http://127.0.0.1:3101/products/classic-rib-tank/');const choices=page.locator('.option-button');if(await choices.count()){await choices.first().click();assert.equal(await choices.first().getAttribute('aria-pressed'),'true');}
  await page.goto('http://127.0.0.1:3101/');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'דילוג לתוכן');
  await context.close();
 }
 await writeFile(new URL('visual-results.json',output),JSON.stringify(rows,null,2));
 console.log('PASS approved/current screenshots and exact content/geometry at 390 and 1512px for home, About and product; filtering/reset, product options and keyboard skip link');
} finally {await browser.close();}
