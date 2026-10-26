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
  // Do not generate affiliate impressions or clicks during automated checks.
  await page.route('https://*.a8.net/**',r=>r.abort());
  for(const width of [320,390,430,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:4328/compare/');
    await page.waitForSelector('#all-table input');
    assert.equal(await page.locator('h1').count(),1);
    const banners=page.locator('.drivers-work-banner');
    assert.equal(await banners.count(),1);
    assert.equal(await page.locator('section[aria-labelledby="apply-title"] .drivers-work-banner').count(),1);
    for(const banner of await banners.all()){
      assert((await banner.innerText()).includes('【PR】'));
      const link=banner.locator('a');
      assert.equal(await link.getAttribute('href'),'https://px.a8.net/svt/ejp?a8mat=4B40F9+FIGPAQ+58IO+BXQOH');
      assert((await link.getAttribute('rel')).includes('nofollow'));
      assert.equal(await link.locator('img').getAttribute('src'),'https://www27.a8.net/svt/bgt?aid=260527653938&wid=005&eno=01&mid=s00000024432002005000&mc=1');
      assert.equal(await banner.locator('img[width="1"]').getAttribute('src'),'https://www18.a8.net/0.gif?a8mat=4B40F9+FIGPAQ+58IO+BXQOH');
      const bounds=await link.evaluate(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right}));
      assert(bounds.left>=0&&bounds.right<=width,'banner fits viewport');
    }
    assert(await page.locator('a[href="#picked"]').evaluate(a=>getComputedStyle(a).color!==getComputedStyle(a).backgroundColor));
    assert.equal(await page.locator('#all-table input').count(),31);
    assert.equal(await page.locator('#all-table .detail-button').count(),31);
    const detailRowHeight=await page.locator('#all-table tbody tr:last-child').evaluate(row=>row.getBoundingClientRect().height);
    assert(detailRowHeight<=70,'compact details row');
    const numericCells=await page.locator('#all-table .primary-value').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,width:n.scrollWidth,available:n.clientWidth})));
    for(const cell of numericCells)assert(cell.width<=cell.available+1,'numeric value fits its cell '+width+' '+JSON.stringify(cell));
    assert.equal(await page.locator('#all-table .rate-suffix').count(),4);
    assert.equal(await page.locator('#all-table .primary-value .rate-suffix').count(),4);
    const rateHeight=await page.locator('#all-table tbody tr').first().evaluate(n=>n.getBoundingClientRect().height);
    if(width<=600)assert(rateHeight<80,'compact commission row');
    const miyagiRate=page.locator('#all-table tbody tr').nth(0).locator('td').nth(19);
    assert(!(await miyagiRate.innerText()).includes('賞与'));
    assert((await miyagiRate.innerText()).includes('休日出勤'));
    const miyagiDetail=page.locator('#all-table .detail-button').nth(19);
    await miyagiDetail.scrollIntoViewIfNeeded();
    const beforeDetail=await page.locator('#all-table').evaluate(node=>({top:node.scrollTop,left:node.scrollLeft,pageY:window.scrollY}));
    await miyagiDetail.click();
    assert.equal(await page.locator('#company-details').evaluate(node=>node.open),true);
    assert((await page.locator('#company-details-title').innerText()).includes('宮城交通'));
    assert((await page.locator('#company-details-body').innerText()).includes('隔日・賞与込み'));
    assert((await page.locator('#company-details-body .detail-group h3').allTextContents()).includes('歩合'));
    const modalBounds=await page.locator('#company-details').evaluate(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right}));
    assert(modalBounds.left>=0&&modalBounds.right<=width,'details fit viewport');
    await page.keyboard.press('Tab');
    assert(await page.locator('#company-details').evaluate(node=>node.contains(document.activeElement)),'focus stays in dialog');
    if(width===390)await page.screenshot({path:'C:/Users/wtknt/Documents/TenstrageVault/outputs/taxi-comparison-details-20261026.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#company-details').evaluate(node=>node.open),false);
    assert(await miyagiDetail.evaluate(node=>document.activeElement===node),'focus returns to details button');
    assert.deepEqual(await page.locator('#all-table').evaluate(node=>({top:node.scrollTop,left:node.scrollLeft,pageY:window.scrollY})),beforeDetail,'comparison scroll restored');
    const cells=await page.locator('#all-table tbody tr:not(:last-child) td').evaluateAll(nodes=>nodes.map(node=>{
      const copy=node.cloneNode(true);copy.querySelectorAll('.holiday').forEach(n=>n.remove());return copy.textContent;
    }));
    for(const text of cells)if(text.includes('未確認'))assert.equal(text,'未確認');
    assert(!(await page.locator('#all-table tbody tr').nth(2).locator('td').nth(13).innerText()).includes('最大'));
    await page.locator('#all-table .detail-button').nth(13).click();
    assert((await page.locator('#company-details-body').innerText()).includes('免許費用を含む'));
    assert((await page.locator('#company-details-body .detail-group h3').allTextContents()).includes('入社支援金'));
    await page.locator('#close-company-details').click();
    await page.locator('#all-table .detail-button').nth(5).click();
    assert((await page.locator('#company-details-body').innerText()).includes('最大35万 × 6か月'));
    await page.locator('#close-company-details').click();
    await page.locator('#all-table .detail-button').nth(1).click();
    assert((await page.locator('#company-details-body').innerText()).includes('または'));
    await page.locator('#close-company-details').click();
    if(width===390){
      for(let i=0;i<31;i++){
        await page.locator('#all-table .detail-button').nth(i).click();
        assert((await page.locator('#company-details-body .detail-group').count())>0,'company '+i+' has details');
        await page.locator('#close-company-details').click();
      }
    }
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
      const names=scroll.querySelector('thead tr:nth-child(2) th:nth-child(2)').getBoundingClientRect();
      const result={top:actions.top,edge:scroll.getBoundingClientRect().top,bottom:actions.bottom,namesTop:names.top};
      scroll.scrollTop=0;return result;
    });
    assert(sticky.bottom<sticky.edge,'controls scroll out of view');
    assert(Math.abs(sticky.namesTop-sticky.edge)<3,'only company names stay sticky');
    await page.locator('#filters summary').click();
    await page.selectOption('#filter-area','足立区');
    assert.equal(await page.locator('#all-table input[value="6"]').count(),1);
    assert.equal(await page.locator('#all-table a[aria-label*="坂本自動車"]').count(),2);
    await page.locator('#reset-filters').click();
    for(let i=0;i<4;i++)await page.locator('#all-table input').nth(i).check();
    await page.locator('#all-table input').nth(4).click();
    assert.equal(await page.locator('#picked-table .company-name').count(),4);
    await page.locator('#picked-table .detail-button').first().click();
    assert((await page.locator('#company-details-title').innerText()).includes('ミツワ交通'));
    await page.locator('#close-company-details').click();
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
