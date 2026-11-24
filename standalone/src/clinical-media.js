const labels={before:'Antes',immediate:'Pós-imediato',follow_up:'Acompanhamento',attachment:'Documento'};
export function createClinicalMediaClient(sb,getClinic,verifyMFA,{fetcher=fetch}={}){
 async function request(action,patient,body={},file=null,retry=true){
  const {data}=await sb.auth.getSession(),token=data.session?.access_token;
  if(!token)throw Error('Sua sessão expirou. Entre novamente para continuar.');
  const metadata={...body,action,clinic:getClinic(),patient};let payload,headers={Authorization:'Bearer '+token};
  if(file){payload=new FormData();payload.set('metadata',JSON.stringify(metadata));payload.set('file',file)}
  else{payload=JSON.stringify(metadata);headers['Content-Type']='application/json'}
  let response;try{response=await fetcher('/api/clinical-media',{method:'POST',headers,body:payload,cache:'no-store'})}catch{throw Error('Não foi possível concluir o envio. O arquivo continua selecionado; tente novamente.')}
  if(!response.ok){let error;try{error=await response.json()}catch{}
   if(retry&&error?.code==='CLINICAL_MFA_REQUIRED'){await verifyMFA();return request(action,patient,body,file,false)}
   const safe={MEDIA_BUDGET_NOT_CONFIGURED:'O limite de armazenamento desta clínica ainda não foi configurado.',MEDIA_BUDGET_EXCEEDED:'O limite de arquivos, espaço ou envios pendentes foi atingido. Nenhuma cobrança ou ampliação automática será feita.',MEDIA_DISABLED:'Fotos e anexos aguardam configuração segura neste ambiente.',MEDIA_ACCESS_DENIED:'Acesso clínico não autorizado. Confira a sessão e as permissões.',FILE_SIZE:'Use um arquivo de até 4 MB.',FILE_TYPE:'Use JPEG, PNG, WebP ou PDF.',FILE_INVALID:'Arquivo inválido. Confira o formato e tente outro arquivo.',FILE_REJECTED:'O arquivo foi recusado pela verificação de segurança.',PDF_ACTIVE_CONTENT:'O PDF contém recursos ativos e não pode ser anexado.',PDF_UNSUPPORTED:'Use um PDF sem proteção e com até 100 páginas.',IMAGE_UNSUPPORTED:'Use uma fotografia estática compatível.',SCANNER_UNAVAILABLE:'Verificação de segurança indisponível. O arquivo não foi liberado.',MEDIA_INVALID:'Confira os dados do arquivo e a sessão clínica.',MEDIA_INTEGRITY:'Falha na conferência de integridade. O arquivo não foi entregue.'};
   throw Error(safe[error?.code]||'Não foi possível concluir. Preserve a seleção e tente novamente.');
  }
  return action==='export'?response.blob():response.json();
 }
 return {request,labels};
}

// Stateless gallery view: no patient files or signed URLs enter browser storage.
export function mountClinicalMedia({container,patient,entries,access,client,onBack,onDirty=()=>{}}){
 let alive=true,items=[],cursor=null,pending=null,selected=null,busy=false,compare=[],resumeUpload=null;const urls=new Set(),cleanups=[];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n};
 const notice=el('p');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const gallery=el('section');gallery.className='clinical-media-grid';gallery.setAttribute('aria-label','Linha do tempo fotográfica');
 const controls=el('div');controls.className='toolbar';
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.className='secondary';b.onclick=fn;return b};
 const field=(label,input)=>{const l=el('label',label);l.className='field';l.append(input);return l};
 const fail=error=>{if(alive)notice.textContent=error.message};
 const checkAlive=()=>{if(!alive)throw Error('Tela encerrada.')};
 const cleanup=()=>{alive=false;cleanups.forEach(fn=>fn());for(const url of urls)URL.revokeObjectURL(url);onDirty(false)};
 const back=button('Voltar ao prontuário',()=>{if(busy)return;if((pending||selected)&&!confirm('Descartar a seleção de arquivo ainda não concluída?'))return;cleanup();onBack()});
 controls.append(back);container.replaceChildren(el('h3','Fotografias e anexos'),controls,notice);
 controls.append(button('Consultar armazenamento da clínica',async()=>{
  try{const usage=await client.request('usage',patient);checkAlive();if(!usage.configured){notice.textContent='O limite de armazenamento ainda precisa ser definido pela administração. Nenhuma contratação é feita por esta tela.';return}
   const mb=value=>(Number(value)/1000000).toLocaleString('pt-BR',{maximumFractionDigits:2});
   notice.textContent=mb(usage.reservedBytes)+' MB usados ou reservados de '+mb(usage.limitBytes)+' MB definidos para esta clínica · '+usage.files+' arquivos · '+usage.pending+' envios pendentes. Originais e apresentações contam juntos. Este é o controle interno da clínica, não uma consulta de faturamento do provedor.';
  }catch(error){fail(error)}
 }));
 const privacy=el('p','Documentação clínica, tratamento de dados e divulgação têm finalidades distintas. Nenhuma imagem é publicada automaticamente. URLs de visualização expiram em 30 segundos; uma revogação impede novas emissões, sem invalidar instantaneamente um link já emitido.');privacy.className='clinical-help';container.append(privacy);
 if(access.can_write){
  const form=el('form');form.className='card clinical-media-upload';form.autocomplete='off';
  const file=el('input');file.type='file';file.name='clinicalFile';file.accept='image/jpeg,image/png,image/webp,application/pdf';file.required=true;
  const camera=el('input');camera.type='file';camera.name='clinicalCamera';camera.accept='image/jpeg,image/png,image/webp';camera.setAttribute('capture','environment');
  const date=el('input');date.type='datetime-local';date.name='capturedAt';date.required=true;const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const region=el('input');region.name='region';region.maxLength=120;
  const notes=el('textarea');notes.name='notes';notes.maxLength=2000;
  const stage=el('select');stage.name='stage';for(const [value,label] of Object.entries(labels)){const o=el('option',label);o.value=value;stage.append(o)}
  const session=el('select');session.name='entryId';session.append(new Option('Sem vínculo adicional',''));for(const e of entries.filter(e=>['procedure','evolution','evaluation'].includes(e.kind)))session.append(new Option((e.payload.summary||labels[e.kind]||'Atendimento').slice(0,100),e.id));
  const basis=el('select');basis.name='clinicalBasis';basis.required=true;basis.append(new Option('Selecione a base definida pelo responsável',''),new Option('Consentimento clínico documentado','consent_documented'),new Option('Outra base assistencial previamente avaliada','care_basis_reviewed'));
  const reference=el('textarea');reference.name='basisReference';reference.required=true;reference.minLength=5;reference.maxLength=500;
  let resumeItem=null;
  const processing=el('textarea');processing.name='processingBasisReference';processing.required=true;processing.minLength=5;processing.maxLength=500;
  const submit=el('button','Validar e enviar arquivo');submit.type='submit';
  form.append(field('Arquivo · até 4 MB, JPEG, PNG, WebP ou PDF',file),field('Capturar com câmera, se disponível',camera),field('Data e horário da captura ou documento',date),field('Região',region),field('Classificação',stage),field('Atendimento relacionado',session),field('Observações pertinentes',notes),field('Base da documentação clínica',basis),field('Referência da autorização ou justificativa clínica avaliada',reference),field('Referência da base de armazenamento e tratamento',processing),el('small','A seleção registra a decisão do responsável; não comprova validade jurídica ou autorização publicitária. Originais são preservados. A apresentação remove metadados e pode ajustar orientação/tamanho, sem retoque estético.'),submit);container.append(form);
  const changed=(source,other)=>{if(pending)return;selected=source.files[0]||null;if(selected){other.value='';file.required=false;if(!resumeItem)stage.value=selected.type==='application/pdf'?'attachment':'before';onDirty(true)}};
  file.onchange=()=>changed(file,camera);camera.onchange=()=>changed(camera,file);
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   if(!pending){if(!selected||!form.reportValidity())return;if(selected.size>4_000_000)return fail(Error('Use um arquivo de até 4 MB. O original não será reduzido automaticamente.'));
    pending={file:selected,body:resumeItem?{id:resumeItem.id,capturedAt:resumeItem.capturedAt,region:resumeItem.region,notes:resumeItem.notes,stage:resumeItem.stage,entryId:resumeItem.entryId||'',clinicalBasis:resumeItem.clinicalBasis,basisReference:resumeItem.basisReference,processingBasisReference:resumeItem.processingBasisReference}:{id:crypto.randomUUID(),capturedAt:new Date(date.value).toISOString(),region:region.value,notes:notes.value,stage:stage.value,entryId:session.value,clinicalBasis:basis.value,basisReference:reference.value,processingBasisReference:processing.value}};
   }
   busy=true;submit.disabled=true;for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=true;notice.textContent='Verificando segurança e integridade do arquivo…';
   try{await client.request('upload',patient,pending.body,pending.file);checkAlive();pending=null;selected=null;resumeItem=null;form.reset();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);file.required=true;onDirty(false);items=[];cursor=null;await load();notice.textContent='Arquivo validado e salvo. O original permanece privado.'}
   catch(error){fail(error);notice.textContent+=' Repetir o envio recupera a mesma solicitação. Para escolher outro arquivo, descarte a seleção.'}
   finally{busy=false;if(alive){submit.disabled=false;if(!pending)for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=false}}
  };
  resumeUpload=item=>{if(busy)return;if((selected||pending)&&!confirm('Descartar a seleção atual para retomar outro envio?'))return;pending=null;selected=null;resumeItem=item;form.reset();date.value=new Date(new Date(item.capturedAt).getTime()-new Date(item.capturedAt).getTimezoneOffset()*60000).toISOString().slice(0,16);region.value=item.region;notes.value=item.notes;stage.value=item.stage;session.value=item.entryId||'';basis.value=item.clinicalBasis;reference.value=item.basisReference;processing.value=item.processingBasisReference;for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=input!==file&&input!==camera;file.required=true;onDirty(true);file.focus();notice.textContent='Selecione exatamente o arquivo original deste envio pendente. Os metadados e o ID serão preservados; um arquivo diferente será recusado.'};
  form.append(button('Descartar seleção',()=>{if(busy||!confirm('Descartar esta seleção de arquivo?'))return;pending=null;selected=null;resumeItem=null;form.reset();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);file.required=true;for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=false;onDirty(false);notice.textContent='Seleção descartada. Um envio pendente no servidor permanece privado.'}));
 }
 const compareButton=button('Comparar duas fotos selecionadas',()=>showComparison());controls.append(compareButton);container.append(gallery);
 const older=button('Carregar arquivos anteriores',()=>load());container.append(older);
 async function imageFor(item){const img=el('img');img.alt=[labels[item.stage],item.region,new Date(item.capturedAt).toLocaleString('pt-BR')].filter(Boolean).join(' · ');img.referrerPolicy='no-referrer';const result=await client.request('view',patient,{id:item.id});checkAlive();img.src=result.url;return img}
 function transientView(view){const modal=el('dialog');modal.className='clinical-image-modal';modal.setAttribute('aria-label','Visualização clínica');modal.append(view,button('Fechar visualização',()=>{modal.close();modal.remove()}));document.body.append(modal);modal.addEventListener('close',()=>modal.remove(),{once:true});cleanups.push(()=>modal.remove());modal.showModal()}
 async function showComparison(){
  if(compare.length!==2)return fail(Error('Selecione exatamente duas fotografias.'));
  try{const pair=compare.map(id=>items.find(i=>i.id===id)),view=el('section');view.append(el('h3','Comparação clínica'));
   const images=await Promise.all(pair.map(imageFor));const side=el('div');side.className='clinical-photo-pair';images.forEach((img,i)=>{const figure=el('figure');figure.append(img,el('figcaption',img.alt));side.append(figure)});view.append(side);
   // Reuse the two freshly authorized image resources for the overlay instead
   // of requesting two extra signed URLs for the very same comparison.
   const sliding=el('div');sliding.className='clinical-photo-slider';const layers=images.map(img=>img.cloneNode(true));sliding.append(...layers);layers[1].style.clipPath='inset(0 50% 0 0)';
   const range=el('input');range.type='range';range.min='0';range.max='100';range.value='50';range.setAttribute('aria-label','Posição do comparador');range.oninput=()=>layers[1].style.clipPath='inset(0 '+(100-Number(range.value))+'% 0 0)';
   view.append(el('p','Lado a lado e sobreposição. Datas, enquadramento e iluminação podem diferir; a comparação não mede resultado automaticamente.'),sliding,range);checkAlive();transientView(view);
  }catch(error){fail(error)}
 }
 function draw(){
  gallery.replaceChildren();for(const item of items){const card=el('article');card.className='card clinical-media-card';card.append(el('h4',labels[item.stage]+' · '+new Date(item.capturedAt).toLocaleString('pt-BR')),el('p',item.region),el('p',item.notes),el('small',(item.professionalName||'Profissional')+' · '+(item.registry||'')));
   if(item.state!=='ready'){card.append(el('p','Envio pendente. O arquivo só fica disponível após completar as verificações.'));if(resumeUpload)card.append(button('Retomar envio pendente',()=>resumeUpload(item)));gallery.append(card);continue}
   if(item.mime!=='application/pdf'){
    const choice=el('input');choice.type='checkbox';choice.setAttribute('aria-label','Selecionar foto para comparação');choice.checked=compare.includes(item.id);choice.onchange=()=>{if(choice.checked&&compare.length>=2){choice.checked=false;return fail(Error('A comparação usa duas fotografias.'))}compare=choice.checked?[...compare,item.id]:compare.filter(id=>id!==item.id)};card.append(field('Comparar',choice));
    const holder=el('div');card.append(holder);const show=async()=>{try{holder.replaceChildren(await imageFor(item))}catch(error){fail(error)}};
    card.append(button('Visualizar fotografia',show),button('Ampliar fotografia',async()=>{try{transientView(await imageFor(item))}catch(error){fail(error)}}));
   }else card.append(el('p','PDF clínico · abertura por exportação autorizada. Assinaturas do anexo não foram validadas.'));
   if(access.can_export)card.append(button(item.mime==='application/pdf'?'Baixar documento':'Exportar original',async()=>{try{const blob=await client.request('export',patient,{id:item.id});checkAlive();const url=URL.createObjectURL(blob);urls.add(url);const a=el('a');a.href=url;a.download='pellum-arquivo.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[item.mime]);a.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url)},1000)}catch(error){fail(error)}}));
   card.append(el('small',item.publicityRevoked?'Revogação de divulgação registrada. O histórico clínico foi preservado.':'Este arquivo não concede autorização de divulgação.'));
   if(access.can_write&&!item.publicityRevoked)card.append(button('Registrar revogação de divulgação',async()=>{if(!confirm('Registrar revogação para divulgação futura, preservando o arquivo clínico?'))return;try{await client.request('publicity_revoke',patient,{id:item.id});item.publicityRevoked=true;draw();notice.textContent='Revogação registrada. Contate os responsáveis por usos externos anteriores; não há publicação automática.'}catch(error){fail(error)}}));
   gallery.append(card);
  }if(!items.length)gallery.append(el('p','Nenhum arquivo clínico cadastrado.'));
 }
 async function load(){
  older.disabled=true;notice.textContent='Carregando arquivos autorizados…';
  try{const next=await client.request('list',patient,cursor||{});checkAlive();for(const item of next)if(!items.some(i=>i.id===item.id))items.push(item);cursor=next.length?{before:next.at(-1).capturedAt,beforeId:next.at(-1).id}:cursor;older.hidden=next.length<50;draw();notice.textContent='Arquivos clínicos privados. Se uma visualização expirar, solicite novamente.'}catch(error){fail(error)}finally{if(alive)older.disabled=false}
 }
 load();return {dispose:cleanup,get pending(){return busy}};
}
