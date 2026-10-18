import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('wrangler'))('esbuild');
const built=await esbuild.build({entryPoints:[new URL('../../storefront/src/app/about/page.tsx',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'isolated-settings',setup(build){build.onResolve({filter:/^@\/lib\/queries$/},()=>({path:'settings',namespace:'test'}));build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='settings'?'export async function getSiteSettings(){return globalThis.__aboutRenderFixture;}':`import React from 'react';export default function Link(props){return React.createElement('a',props);}`,loader:'js'}));}}]});
// Resolve React from this test's installed dependency directory for data imports.
let source=Buffer.from(built.outputFiles[0].contents).toString();
for(const name of ['react/jsx-runtime','react'])source=source.replaceAll('"'+name+'"',JSON.stringify(new URL('file://'+require.resolve(name)).href));
const page=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
try {
 globalThis.__aboutRenderFixture={};let html=renderToStaticMarkup(await page.default());assert.ok(html.includes('עוד מעט נשתף'));assert.ok( /<h1[^>]*>הסיפור שלנו<\/h1>/.test(html));
 globalThis.__aboutRenderFixture={aboutHeading:'המעצבת',aboutIntro:'פתיח',aboutBody:'פסקה ראשונה\n\nפסקה שנייה\nשורה נוספת\n\n<script>alert(1)</script>'};
 html=renderToStaticMarkup(await page.default());assert.ok(/<h1[^>]*>המעצבת<\/h1>/.test(html));assert.ok(html.includes('פסקה שנייה\nשורה נוספת'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 const metadata=await page.generateMetadata();assert.equal(metadata.title,'המעצבת');assert.equal(metadata.description,'פתיח');assert.equal(metadata.alternates.canonical,'/about/');
 console.log('PASS rendered empty/populated About, heading, paragraphs, escaped content and SEO metadata');
} finally {delete globalThis.__aboutRenderFixture;}
