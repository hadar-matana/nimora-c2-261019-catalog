import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url), esbuild=createRequire(require.resolve('wrangler'))('esbuild');
async function load(entry, kind, extra={}) {
 const vars={NEXT_PUBLIC_DEPLOYMENT_KIND:kind,NEXT_PUBLIC_SANITY_PROJECT_ID:'client01',NEXT_PUBLIC_SANITY_DATASET:'catalog',NEXT_PUBLIC_SANITY_API_VERSION:'2025-02-19',NEXT_PUBLIC_SITE_URL:'https://brand.example',NEXT_PUBLIC_ADMIN_DEPLOYMENT_KIND:kind,NEXT_PUBLIC_ADMIN_BRAND_NAME:'Independent Brand',NEXT_PUBLIC_ADMIN_BRAND_DESCRIPTION:'Independent fashion',...extra};
 const define=Object.fromEntries(Object.entries(vars).map(([k,v])=>['process.env.'+k,JSON.stringify(v)]));
 const built=await esbuild.build({entryPoints:[new URL(entry,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],define,plugins:[{name:'isolated-render',setup(build){
  build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));
  build.onResolve({filter:/^@\/lib\/queries$/},()=>({path:'queries',namespace:'test'}));
  build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='queries'?'export async function getSiteSettings(){return globalThis.__brandSettings;}':`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js'}));
  build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }}]});
 let source=`import {createRequire as __createRequire} from 'node:module'; const require=__createRequire(${JSON.stringify(import.meta.url)});\n`+Buffer.from(built.outputFiles[0].contents).toString();
 for(const name of ['react/jsx-runtime','react'])source=source.replaceAll('from "'+name+'"','from '+JSON.stringify(new URL('file://'+require.resolve(name)).href));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
try {
 for(const kind of ['demo','client']) {
  const header=await load('../../storefront/src/components/SiteHeader.tsx',kind);
  const footer=await load('../../storefront/src/components/SiteFooter.tsx',kind);
  const layout=await load('../../storefront/src/app/layout.tsx',kind);
  const admin=await load('../src/components/Brand.tsx',kind);
  const settings={displayName:'Independent Brand',description:'Independent fashion',tagline:'Wear your story',accentColor:'#335544',accentContrastColor:'#ffffff',contactEmail:'hello@example.com',instagramUrl:'independent',logo:{asset:{_id:'image-'+'a'.repeat(40)+'-200x100-png'}}};
  const html=renderToStaticMarkup(React.createElement(header.SiteHeader,{settings}))+renderToStaticMarkup(React.createElement(footer.SiteFooter,{settings}));
  globalThis.__brandSettings=settings;
  const metadata=await layout.generateMetadata();
  const root=renderToStaticMarkup(await layout.default({children:'content'}));
  if(kind==='demo') {
   assert.ok(html.includes('ATELIER'));assert.ok(html.includes('אופנה נשית. בכל יום מחדש.'));assert.ok(!html.includes('<img'));assert.ok(!root.includes('--accent:'));assert.equal(metadata.title.default,'ATELIER');
  } else {
   assert.ok(!html.includes('ATELIER'));assert.ok(html.includes('Independent Brand'));assert.ok(html.includes('<img'));assert.ok(html.includes('Wear your story'));assert.ok(html.includes('mailto:hello@example.com'));assert.ok(html.includes('instagram.com/independent'));assert.ok(root.includes('--accent:#335544'));assert.equal(metadata.title.default,'Independent Brand');assert.equal(metadata.description,'Independent fashion');assert.ok(metadata.openGraph.images[0].includes('/client01/catalog/'));
  }
  const adminHtml=renderToStaticMarkup(React.createElement(admin.Brand));
  assert.ok(adminHtml.includes(kind==='demo'?'ATELIER':'Independent Brand'));
 }
 console.log('PASS real header/footer/admin rendering, CMS logo/contact/social/tagline/colors/SEO, exact demo name/tagline/no-logo/no-color-overrides');
} finally {delete globalThis.__brandSettings;}
