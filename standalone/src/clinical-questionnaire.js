// Same validation contract as anamnesis, with names isolated from base fields.
export function mountClinicalQuestionnaire(container,model,questions,answers={}){
 model.validateQuestions(questions);const inputs=new Map(),wrappers=new Map();container.replaceChildren();
 for(const q of questions){
  const wrap=document.createElement('label');wrap.className='field';wrap.textContent=q.label+(q.required?' *':'');
  let input;
  if(['tri','single','multi'].includes(q.type)){
   input=document.createElement('select');input.multiple=q.type==='multi';
   if(q.type!=='multi')input.append(new Option('Não respondido / não pertinente',''));
   for(const [value,label] of q.type==='tri'?Object.entries(model.triLabels):q.options.map(o=>[o,o])){const option=new Option(label,value);option.selected=Array.isArray(answers[q.id])?answers[q.id].includes(value):answers[q.id]===value;input.append(option)}
  }else{input=document.createElement(q.type==='text'?'textarea':'input');if(q.type!=='text')input.type=q.type;if(q.type==='number')input.step='any';input.value=answers[q.id]??'';input.maxLength=4000}
  input.name='form_answer_'+q.id;wrap.append(input);container.append(wrap);inputs.set(q.id,input);wrappers.set(q.id,wrap);
 }
 const raw=()=>{const values=Object.create(null);for(const q of questions){if(!model.visibleQuestion(q,values))continue;const input=inputs.get(q.id);values[q.id]=input.multiple?Array.from(input.selectedOptions,o=>o.value):input.value}return values};
 const refresh=()=>{const values=raw();for(const q of questions)wrappers.get(q.id).hidden=!model.visibleQuestion(q,values)};
 container.addEventListener('input',refresh);container.addEventListener('change',refresh);refresh();
 return {read:review=>model.validateAnswers(questions,raw(),review)};
}
