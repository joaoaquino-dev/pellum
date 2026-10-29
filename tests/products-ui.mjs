import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const state={products:[{id:'p1',name:'Luva',price:50,quantity:100,packCount:2,balance:200,owner:0,minimum:10,unit:'unidades',lot:'A',expiry:'2027-10-28',category:'consumable',movements:[]}],records:[]};
let pending=0,saves=0,routes=0,form;
const nodes={};const $=key=>nodes[key]??=( {textContent:'',onclick:null});
class FormDataStub{constructor(f){this.f=f}*[Symbol.iterator](){for(const [k,e] of Object.entries(this.f.elements))if(!e.disabled)yield[k,e.value]}}
const context={state,window:{AURA_CONNECT(){},AURA_CLINIC_SYNC:()=>({pending,blocked:false}),productForm(){form={elements:{},reportValidity:()=>true};for(const key of ['name','category','unit','quantity','price','unitPrice','packCount','minimum','owner','lot','expiry'])form.elements[key]={value:'',disabled:false,dispatchEvent(){}};nodes['#supplyForm']=form},stockMovement(){}},$,Event:class{},FormData:FormDataStub,toast(){},esc:s=>String(s).replaceAll('<','&lt;'),showModal(){},closeModal(){},persist(){saves++},route(){routes++}};
vm.runInNewContext(await readFile('standalone/src/runtime-products.js','utf8'),context);
context.window.AURA_CONNECT({});context.window.editProduct('p1');
form.elements.name.value='Luva corrigida';form.elements.price.value='60';form.elements.quantity.value='50';form.onsubmit({preventDefault(){}});
assert.equal(state.products[0].name,'Luva corrigida');assert.equal(state.products[0].price,60);assert.equal(state.products[0].balance,100);
state.products[0].movements.push({id:'m1',qty:-1});state.products[0].balance=99;
context.window.editProduct('p1');assert.equal(form.elements.price.disabled,true);assert.equal(form.elements.quantity.disabled,true);
form.elements.name.value='Luva utilizada';form.onsubmit({preventDefault(){}});assert.equal(state.products[0].price,60);assert.equal(state.products[0].balance,99);
pending=1;context.window.removeProduct('p1');assert.equal(nodes['#confirmProductDelete'],undefined);pending=0;
context.window.removeProduct('p1');$('#confirmProductDelete').onclick();assert.equal(state.products[0].deleted,true);assert.equal(state.products[0].movements.length,1);
assert.equal(saves,3);assert.equal(routes,3);
console.log('PASS: unused purchase correction recalculates balance; used lot cost stays locked; pending sync blocks deletion; confirmed deletion retains movement history.');
