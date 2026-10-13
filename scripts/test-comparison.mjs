import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/wtknt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(4328,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage();
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.googletagmanager.com/**',r=>r.abort());
  for(const width of [320,390,430,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:4328/compare/');
    await page.waitForSelector('#all-table input');
    assert.equal(await page.locator('h1').count(),1);
    assert(await page.locator('a[href="#picked"]').evaluate(a=>getComputedStyle(a).color!==getComputedStyle(a).backgroundColor));
    assert.equal(await page.locator('#all-table input').count(),31);
    const miyagiRate=page.locator('#all-table tbody tr').nth(0).locator('td').nth(19);
    assert(!(await miyagiRate.innerText()).includes('賞与'));
    assert((await miyagiRate.innerText()).includes('休日出勤'));
    assert((await page.locator('#all-table .company-note').nth(19).innerText()).includes('隔日・賞与込み'));
    const cells=await page.locator('#all-table tbody tr:not(:last-child) td').evaluateAll(nodes=>nodes.map(node=>{
      const copy=node.cloneNode(true);copy.querySelectorAll('.holiday').forEach(n=>n.remove());return copy.textContent;
    }));
    for(const text of cells)if(text.includes('未確認'))assert.equal(text,'未確認');
    assert(!(await page.locator('#all-table tbody tr').nth(2).locator('td').nth(13).innerText()).includes('最大'));
    assert((await page.locator('#all-table .company-note').nth(13).innerText()).includes('最大'));
    assert((await page.locator('#all-table .company-note').nth(5).innerText()).includes('最大35万 × 6か月'));
    assert((await page.locator('#all-table .company-note').nth(1).innerText()).includes('または'));
    const guarantees=await page.locator('#all-table .guarantees').evaluateAll(nodes=>nodes.map(node=>({
      count:node.children.length,
      lines:[...node.children].map(line=>({text:line.textContent,width:line.scrollWidth,available:line.clientWidth,height:line.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(line).lineHeight)}))
    })));
    for(const guarantee of guarantees){
      assert(guarantee.count<=3);
      for(const line of guarantee.lines){
        assert(/^\d+(?:\.\d+)?万 × \d+か月$/.test(line.text));
        assert(line.width<=line.available+1,`guarantee overflow at ${width}px: ${JSON.stringify(line)}`);
        assert(line.height<=line.lineHeight+1,'single-line guarantee');
      }
    }
    assert((await page.locator('#all-table .company-note').nth(13).innerText()).includes('免許費用を含む'));
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://takuzo-taxi.com/compare/');
    const layout=await page.evaluate(()=>{
      const cells=[...document.querySelectorAll('#all-table thead tr:first-child>*')];
      return {width:document.documentElement.scrollWidth,right:cells[3].getBoundingClientRect().right,edge:document.querySelector('#all-table').getBoundingClientRect().right,tops:cells.slice(1).map(c=>c.querySelector('.pick').getBoundingClientRect().top)};
    });
    assert(layout.width<=width+1,'page overflow');
    if(width<=600)assert(layout.right<=layout.edge+1,'three columns '+JSON.stringify(layout));
    assert(Math.max(...layout.tops)-Math.min(...layout.tops)<1,'aligned controls');
    assert.equal(await page.locator('#all-table thead tr').count(),2);
    assert.equal(await page.locator('#all-table thead tr:first-child input').count(),31);
    assert.equal(await page.locator('#all-table thead tr:nth-child(2) .company-name').count(),31);
    const sticky=await page.evaluate(()=>{
      const scroll=document.querySelector('#all-table');scroll.scrollTop=220;
      const actions=scroll.querySelector('thead tr:first-child').getBoundingClientRect();
      const names=scroll.querySelector('thead tr:nth-child(2)').getBoundingClientRect();
      const result={top:actions.top,edge:scroll.getBoundingClientRect().top,bottom:actions.bottom,namesTop:names.top};
      scroll.scrollTop=0;return result;
    });
    assert(Math.abs(sticky.top-sticky.edge)<3,'sticky control row');
    assert(sticky.namesTop>=sticky.bottom-1,'header rows must not overlap');
    await page.locator('#filters summary').click();
    await page.selectOption('#filter-area','足立区');
    assert.equal(await page.locator('#all-table input[value="6"]').count(),1);
    assert.equal(await page.locator('#all-table a[aria-label*="坂本自動車"]').count(),2);
    await page.locator('#reset-filters').click();
    for(let i=0;i<4;i++)await page.locator('#all-table input').nth(i).check();
    await page.locator('#all-table input').nth(4).click();
    assert.equal(await page.locator('#picked-table .company-name').count(),4);
    await page.selectOption('#filter-area','江東区');
    assert.equal(await page.locator('#picked-table .company-name').count(),4);
    await page.locator('#picked-table button').first().click();
    assert.equal(await page.locator('#picked-table .company-name').count(),3);
    await page.locator('#reset-filters').click();
    await page.selectOption('#sort-order','rate');
    const rates=await page.locator('#all-table tbody tr:first-child .rate').allTextContents();
    const nums=rates.map(parseFloat);assert(nums.every((n,i)=>!i||nums[i-1]>=n));
    await page.selectOption('#sort-order','default');
    await page.locator('#clear-selection').click();
    await page.evaluate(()=>{document.querySelector('#filters').open=false;document.querySelector('#all-table').scrollTo({left:0,top:0,behavior:'instant'});scrollTo({top:0,behavior:'instant'})});
    await page.mouse.move(0,0);
    if(width===390)await page.screenshot({path:'C:/Users/wtknt/Documents/TenstrageVault/outputs/taxi-production-comparison-20261013.png'});
    console.log(`PASS ${width}px: layout, filters, maps, selection, sorting, metadata`);
  }
  assert.deepEqual(errors,[]);
  for(const route of ['/','/preparation/']){
    await page.goto('http://127.0.0.1:4328'+route);
    assert(await page.locator('main a[href="/compare/"]').count()>0,route+' comparison entry');
    assert.equal(await page.locator('.site-footer a[href="/compare/"]').count(),1);
    await page.locator('main a[href="/compare/"]').first().click();
    await page.waitForSelector('#all-table input');
    assert.equal(await page.locator('#all-table input').count(),31);
  }
  console.log('PASS home/preparation/footer links and navigation');
} finally {await browser.close();server.close();}
