const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

// Keep the existing select as the source of values and form events.
export function prepareSelects(container){
  if(!isIOS)return;
  for(const select of container.querySelectorAll('select:not([hidden])')){
    const label=select.getAttribute('aria-label')??select.closest('label')?.firstElementChild?.textContent.trim();
    const button=document.createElement('button');
    button.type='button';
    button.className='ios-select';
    button.disabled=select.disabled;
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls','select-dialog');
    const updateButton=()=>{
      button.textContent=select.selectedOptions[0]?.textContent??'';
      button.setAttribute('aria-label',[label,button.textContent].filter(Boolean).join('、'));
    };
    updateButton();
    button.addEventListener('click',()=>openSelect(select,label,updateButton));
    select.before(button);
    select.hidden=true;
  }
}

export function focusSelect(select){
  if(select?.hidden)select.previousElementSibling?.focus();
  else select?.focus();
}

function openSelect(select,label,updateButton){
  const dialog=document.getElementById('select-dialog');
  const options=document.getElementById('select-options');
  document.getElementById('select-title').textContent=label||'項目を選ぶ';
  options.replaceChildren(...Array.from(select.options,option=>{
    const choice=document.createElement('button');
    choice.type='button';
    choice.textContent=option.textContent;
    choice.disabled=option.disabled;
    choice.setAttribute('aria-pressed',String(option.selected));
    choice.addEventListener('click',()=>{
      dialog.close();
      if(!select.isConnected||select.value===option.value)return;
      select.value=option.value;
      updateButton();
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    return choice;
  }));
  dialog.showModal();
  options.querySelector('[aria-pressed="true"]:not(:disabled)')?.focus();
}
