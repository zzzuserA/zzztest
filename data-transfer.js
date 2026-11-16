window.zzzDataTransfer=(()=>{
  const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const maxBytes=16*1024*1024;

  async function readBytes(stream){
    const reader=stream.getReader();
    const chunks=[];
    let size=0;
    try{
      for(;;){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.length;
        if(size>maxBytes){
          await reader.cancel();
          throw Error('共有データは16MB以下にしてください。');
        }
        chunks.push(value);
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){
      bytes.set(chunk,offset);
      offset+=chunk.length;
    }
    return bytes;
  }

  async function encodeShare(backup){
    let bytes=new TextEncoder().encode(JSON.stringify(backup));
    if(bytes.length>maxBytes)throw Error('共有データは16MB以下にしてください。');
    let marker='R';
    if(typeof CompressionStream==='function'){
      const compressed=await readBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));
      if(compressed.length<bytes.length){
        bytes=compressed;
        marker='G';
      }
    }
    const chunks=[];
    for(let start=0;start<bytes.length;start+=8192){
      chunks.push(String.fromCharCode(...bytes.subarray(start,start+8192)));
    }
    return 'ZZZ1'+marker+'.'+btoa(chunks.join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function decodeShare(text){
    const code=text.replace(/\s/g,'');
    if(code.length>Math.ceil(maxBytes*4/3)+6)throw Error('共有コードが長すぎます。');
    const match=/^ZZZ1([GR])\.([A-Za-z0-9_-]+)$/.exec(code);
    if(!match)throw Error('共有コードを最初から最後まで貼り付けてください。');
    if(match[1]==='G'&&typeof DecompressionStream!=='function'){
      throw Error('このブラウザで圧縮コードを開けません。JSONファイルでインポートしてください。');
    }
    try{
      const binary=atob(match[2].replace(/-/g,'+').replace(/_/g,'/'));
      let bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
      if(bytes.length>maxBytes)throw Error();
      if(match[1]==='G'){
        bytes=await readBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
      }
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    }catch{throw Error('共有コードを読み込めませんでした。コード全体をコピーしてください。');}
  }

  function write(entries){
    const previous=entries.map(([key])=>localStorage.getItem(key));
    let written=0;
    try{
      for(const [key,value] of entries){
        localStorage.setItem(key,value);
        written++;
      }
    }catch(error){
      const changed=entries.slice(0,written);
      for(const [key] of changed)localStorage.removeItem(key);
      changed.forEach(([key],i)=>{
        if(previous[i]!==null)localStorage.setItem(key,previous[i]);
      });
      throw error;
    }
  }

  function install(container,{tool,label,filename,snapshot,validate,restore}){
    container.innerHTML=`
      <button type="button">エクスポート</button>
      <button type="button">インポート</button>
      <button type="button" aria-haspopup="dialog">共有コード</button>
      <input type="file" accept=".json,application/json" aria-label="インポートするJSONファイル" hidden>
      <span class="data-transfer-status" role="status"></span>
      <dialog class="data-share" aria-label="共有コード">
        <header>
          <h2>共有コード</h2>
          <form method="dialog"><button type="submit">閉じる</button></form>
        </header>
        <label>この端末の共有コード<textarea rows="3" readonly spellcheck="false"></textarea></label>
        <button type="button" data-share-copy disabled>コードをコピー</button>
        <label>共有元のコード<textarea rows="3" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></label>
        <button type="button" data-share-import>コードを読み込む</button>
        <p class="data-transfer-status" role="status"></p>
      </dialog>`;
    const [download,upload,share,input,status,dialog]=container.children;
    const [outgoing,incoming]=dialog.querySelectorAll('textarea');
    const copy=dialog.querySelector('[data-share-copy]');
    const importCode=dialog.querySelector('[data-share-import]');
    const codeStatus=dialog.querySelector('[role="status"]');
    const backupOf=()=>({format:'zzz-tool-data',version:1,tool,data:snapshot()});

    function applyBackup(backup,target,source){
      if(backup?.format!=='zzz-tool-data'||backup.version!==1||backup.tool!==tool){
        target.textContent=label+'から発行した'+source+'を使用してください。';
        return false;
      }
      let data;
      try{data=validate(backup.data);}
      catch{target.textContent='データ形式が正しくありません。';return false;}
      if(!confirm(label+'の現在の入力・設定を読み込んだデータで置き換えますか？')){
        target.textContent='インポートをキャンセルしました。';
        return false;
      }
      try{restore(data);}
      catch{target.textContent='データを保存できませんでした。ブラウザの保存容量や設定を確認してください。';return false;}
      status.textContent=label+'のデータを読み込みました。';
      return true;
    }

    let generation=0;
    share.addEventListener('click',async ()=>{
      const current=++generation;
      outgoing.value='';
      copy.disabled=true;
      codeStatus.textContent='共有コードを作成中…';
      dialog.showModal();
      try{
        const code=await encodeShare(backupOf());
        if(current!==generation||!dialog.open)return;
        outgoing.value=code;
        copy.disabled=false;
        codeStatus.textContent='';
      }catch(error){
        if(current===generation)codeStatus.textContent=error.message;
      }
    });
    copy.addEventListener('click',async ()=>{
      try{
        await navigator.clipboard.writeText(outgoing.value);
        codeStatus.textContent='共有コードをコピーしました。';
      }catch{
        outgoing.focus();
        outgoing.select();
        codeStatus.textContent='選択したコードをコピーしてください。';
      }
    });
    importCode.addEventListener('click',async ()=>{
      importCode.disabled=true;
      const current=generation;
      try{
        const backup=await decodeShare(incoming.value);
        if(current!==generation||!dialog.open)return;
        if(applyBackup(backup,codeStatus,'共有コード')){
          incoming.value='';
          dialog.close();
        }
      }catch(error){
        if(current===generation)codeStatus.textContent=error.message;
      }finally{importCode.disabled=false;}
    });
    download.addEventListener('click',()=>{
      const json=JSON.stringify(backupOf(),null,2);
      const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;
      link.download=filename+'.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=label+'のデータを書き出しました。';
    });
    upload.addEventListener('click',()=>input.click());
    input.addEventListener('change',async ()=>{
      const file=input.files[0];
      input.value='';
      if(!file)return;
      upload.disabled=true;
      try{
        status.textContent='';
        if(file.size>maxBytes){
          status.textContent='16MB以下のJSONファイルを選択してください。';
          return;
        }
        let backup;
        try{backup=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}
        catch{status.textContent='JSONファイルを読み込めませんでした。';return;}
        applyBackup(backup,status,'JSONファイル');
      }finally{upload.disabled=false;}
    });
  }

  return {install,isRecord,write};
})();
