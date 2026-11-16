window.zzzDataTransfer=(()=>{
  const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

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
      <input type="file" accept=".json,application/json" aria-label="インポートするJSONファイル" hidden>
      <span class="data-transfer-status" role="status"></span>`;
    const [download,upload,input,status]=container.children;
    download.addEventListener('click',()=>{
      const json=JSON.stringify({format:'zzz-tool-data',version:1,tool,data:snapshot()},null,2);
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
        if(file.size>16*1024*1024){
          status.textContent='16MB以下のJSONファイルを選択してください。';
          return;
        }
        let backup;
        try{backup=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}
        catch{status.textContent='JSONファイルを読み込めませんでした。';return;}
        if(backup?.format!=='zzz-tool-data'||backup.version!==1||backup.tool!==tool){
          status.textContent=label+'からエクスポートしたJSONファイルを選択してください。';
          return;
        }
        let data;
        try{data=validate(backup.data);}
        catch{status.textContent='ファイル内のデータ形式が正しくありません。';return;}
        if(!confirm(label+'の現在の入力・設定を読み込んだデータで置き換えますか？')){
          status.textContent='インポートをキャンセルしました。';
          return;
        }
        try{restore(data);}
        catch{status.textContent='データを保存できませんでした。ブラウザの保存容量や設定を確認してください。';return;}
        status.textContent=label+'のデータを読み込みました。';
      }finally{upload.disabled=false;}
    });
  }

  return {install,isRecord,write};
})();
