// Run with Playwright installed: node tests/download-smoke.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/tocfl-photo/';
const results = [];
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const scenario of ['desktop','mobile','share-success','share-cancel','share-denied','blob-null','blob-throw','blob-timeout','click-throw','bad-image','storage-denied','unsupported-share','already-liked','nonwhite']) {
      const context = await browser.newContext({viewport: scenario==='desktop' ? {width:1440,height:1000} : {width:390,height:844}, acceptDownloads:true});
      const page = await context.newPage();
      let posts=0;
      let likePosts=0;
      const requests=[];
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',async route=>{
        const r=route.request(); requests.push({url:r.url(),method:r.method(),body:r.postData()});
        if(r.url().startsWith('https://script.google.com/')) {
          if(r.method()==='POST' && r.url().includes('action=download')) posts++;
          if(r.method()==='POST' && r.url().includes('action=like')) likePosts++;
          await route.fulfill({json:{ok:true,count:10+posts}});
        } else if(r.url().startsWith(new URL(base).origin)) {
          const relative = decodeURIComponent(new URL(r.url()).pathname).replace(/^\/tocfl-photo\//,'') || 'index.html';
          const local = path.resolve('dist',relative);
          assert(local.startsWith(path.resolve('dist')+path.sep));
          const mime = {'.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.html':'text/html','.jpg':'image/jpeg','.png':'image/png'}[path.extname(local)];
          if(fs.existsSync(local)) await route.fulfill({path:local,contentType:mime || 'application/octet-stream'});
          else await route.fulfill({status:404,body:'Not found'});
        }
        else await route.abort(); // No test photos or identities may leave localhost.
      });
      await page.addInitScript(scenario=>{
        if(scenario==='already-liked') localStorage.setItem('tocfl_photo_liked','yes');
        if(scenario.startsWith('share-')) {
          Object.defineProperty(navigator,'canShare',{value:()=>true});
          Object.defineProperty(navigator,'share',{value: data=>{
            window.shareActive=navigator.userActivation.isActive;
            window.sharedFile={name:data.files[0].name,type:data.files[0].type,size:data.files[0].size};
            if(scenario==='share-cancel') return Promise.reject(new DOMException('Cancelled','AbortError'));
            if(scenario==='share-denied') return Promise.reject(new DOMException('Blocked','NotAllowedError'));
            return Promise.resolve();
          }});
        }
        if(scenario==='storage-denied') Storage.prototype.getItem=()=>{throw new Error('Storage blocked')};
        if(scenario==='blob-null') HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};
        if(scenario==='blob-throw') HTMLCanvasElement.prototype.toBlob=function(){throw new DOMException('Tainted','SecurityError')};
        if(scenario==='blob-timeout') HTMLCanvasElement.prototype.toBlob=function(){};
        if(scenario==='unsupported-share') Object.defineProperty(navigator,'canShare',{value:()=>{throw new Error('Unsupported')}});
        if(scenario==='click-throw') HTMLAnchorElement.prototype.click=function(){throw new Error('Download blocked')};
      },scenario);
      await page.goto(base);
      assert.equal(await page.getByText('不代表已儲存人數',{exact:false}).count(),0);
      assert.equal(await page.getByText('網站只能確認已發出下載要求',{exact:false}).count(),0);
      await page.waitForSelector('input[type=file]',{state:'attached'});
      const bytes=await page.evaluate(nonwhite=>{
        const c=document.createElement('canvas'); c.width=600; c.height=800;
        const ctx=c.getContext('2d');ctx.fillStyle=nonwhite?'#0088ff':'white';ctx.fillRect(0,0,600,800);
        ctx.fillStyle='#aa6633';ctx.fillRect(240,120,120,480);
        return Array.from(Uint8Array.from(atob(c.toDataURL().split(',')[1]),c=>c.charCodeAt(0)));
      },scenario==='nonwhite');
      await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:scenario==='bad-image'?Buffer.from('invalid'):Buffer.from(bytes)});
      if(scenario==='bad-image') {
        await page.getByText('無法讀取照片，請選擇有效的 JPG／PNG 照片。',{exact:true}).waitFor();assert.equal(posts,0);
      } else {
        const prepare=page.getByRole('button',{name:'下載成品照片',exact:true});
        await prepare.waitFor();
        await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='下載成品照片').disabled,{timeout:60000});
        if(scenario==='nonwhite') {
          assert.equal(await page.getByText('去背失敗，目前保留原圖；請改用白底照片。',{exact:true}).count(),0);
          assert.deepEqual(await page.locator('canvas').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,1,1).data)),[255,255,255,255]);
        }
        await page.locator('input[type=text]').nth(0).fill('TEST/123');
        await page.locator('input[type=text]').nth(1).fill('測試*Name');
        await prepare.click();
        const status=page.getByRole('status');
        if(scenario.startsWith('blob-')) {
          await status.filter({hasText:'無法產生成品照片'}).waitFor();assert.equal(posts,0);
        } else {
          const download=page.getByRole('button',{name:'下載 PNG 檔案',exact:true});
          await download.waitFor(); assert.equal(posts,0,'Preparation must not count');
          assert.equal(await page.getByRole('dialog').count(),0,'Preparing alone must not show the reminder');
          if(scenario.startsWith('share-')) {
            await page.getByRole('button',{name:'分享／儲存到相簿',exact:true}).click();
            await status.filter({hasText: scenario==='share-success'?'分享介面已回報完成':scenario==='share-cancel'?'已取消分享':'無法開啟分享'}).waitFor();
            assert.equal(await page.evaluate(()=>window.shareActive),true,'Share must retain user activation');
            if(scenario==='share-success') await page.waitForFunction(()=>document.body.textContent.includes('11 次下載'));
            assert.equal(posts,scenario==='share-success'?1:0);
            assert.equal(await page.getByRole('dialog').count(),scenario==='share-success'?1:0,'Only successful sharing shows the reminder');
          } else if(scenario==='click-throw') {
            await download.click();await status.filter({hasText:'無法啟動下載'}).waitFor();assert.equal(posts,0);
          } else {
            const event=page.waitForEvent('download'); await download.click();const artifact=await event;
            assert.equal(artifact.suggestedFilename(),'TEST123_測試Name.png');
            const png=fs.readFileSync(await artifact.path());
            assert.equal(png.readUInt32BE(16),600);assert.equal(png.readUInt32BE(20),800);
            await status.filter({hasText:'已發出下載要求'}).waitFor();
            await page.waitForFunction(()=>document.body.textContent.includes('11 次下載'));
            assert.equal(posts,1);
            const dialog=page.getByRole('dialog');
            await dialog.waitFor();
            await dialog.getByText('重要聲明',{exact:true}).waitFor();
            if(scenario==='mobile') {
              await page.screenshot({path:'tests/mobile-reminder.png',fullPage:true});
              await dialog.getByRole('button',{name:/覺得這項服務有幫助嗎/}).click();
              await dialog.getByRole('heading',{name:'謝謝您的支持！',exact:true}).waitFor();
              assert.equal(likePosts,1);
              assert.equal(await dialog.getByRole('button',{name:/謝謝您的支持/}).isDisabled(),true);
            }
            if(scenario==='already-liked') {
              assert.equal(await dialog.getByRole('button',{name:/謝謝您的支持/}).isDisabled(),true);
              assert.equal(likePosts,0);
            }
            await page.keyboard.press('Escape');
            await dialog.waitFor({state:'hidden'});
            assert.equal(await download.evaluate(b=>b===document.activeElement),true);
            // Editing invalidates the exported snapshot so a stale crop cannot be saved.
            await page.locator('input[type=range]').first().fill('1.5');
            assert.equal(await download.count(),0);
            await page.getByRole('button',{name:'EN',exact:true}).click();
            await page.getByRole('button',{name:'Download Photo',exact:true}).click();
            await page.getByRole('button',{name:'Download PNG file',exact:true}).waitFor();
            await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
            await page.getByRole('button',{name:'Tải tệp PNG',exact:true}).waitFor();
          }
          if(scenario==='mobile') {
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
            await page.screenshot({path:'tests/mobile-preview.png',fullPage:true});
          }
        }
      }
      assert.deepEqual(errors,[]);
      for(const r of requests.filter(r=>r.url.startsWith('https://'))) {
        assert(r.url.startsWith('https://script.google.com/'));
        assert(!r.url.includes('TEST'));assert.equal(r.body,null);
      }
      results.push({scenario,passed:true,downloadPosts:posts});
      console.log('PASS',scenario,'download POSTs:',posts);
      await context.close();
    }
    fs.writeFileSync('tests/results.json',JSON.stringify(results,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
