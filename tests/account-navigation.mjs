import assert from 'node:assert/strict';
import {wireAccountNavigation} from '../standalone/src/account-navigation.js';

function fixture(){
 const exit={href:'/signout-with-chatgpt',target:'_top',dataset:{},onclick:null,removeAttribute(k){delete this[k]}};
 const footer={admin:null,querySelector(selector){
  if(selector==='small a')return exit;
  if(selector==='[data-platform-link]')return this.admin;
  throw Error('Unexpected broad selector: '+selector);
 },prepend(link){assert.equal(this.admin,null);this.admin=link}};
 const root={querySelector(selector){assert.equal(selector,'.asidefoot');return footer},createElement(tag){assert.equal(tag,'a');return {dataset:{},onclick:null}}};
 return {root,footer,exit};
}

let signOuts=0;
const admin=fixture();
const bind=()=>wireAccountNavigation(admin.root,{isAdmin:true,onSignOut:()=>signOuts++});
bind();
assert.equal(admin.footer.admin.href,'#admin');
assert.equal(admin.footer.admin.onclick,null,'Opening administration must never sign out');
assert.equal(signOuts,0);
assert.equal(admin.exit.href,'#');
assert.equal(admin.exit.target,undefined);
assert.equal(admin.exit.dataset.accountLogout,'true');
const link=admin.footer.admin;
bind();
assert.equal(admin.footer.admin,link,'Repeated binding must keep one admin link');
assert.equal(link.onclick,null);
let prevented=false;
admin.exit.onclick({preventDefault(){prevented=true}});
assert.equal(prevented,true);
assert.equal(signOuts,1,'Only the actual logout control must sign out once');

const ordinary=fixture();
wireAccountNavigation(ordinary.root,{isAdmin:false,onSignOut:()=>signOuts++});
assert.equal(ordinary.footer.admin,null,'Ordinary account must not gain platform link');
ordinary.exit.onclick({preventDefault(){}});
assert.equal(signOuts,2);
console.log('PASS: admin navigation preserves session; logout acts only on the account exit; repeated binding is idempotent; ordinary account has no admin link.');
