export function wireAccountNavigation(root,{isAdmin,onSignOut}){
 const footer=root.querySelector('.asidefoot');
 if(!footer)return;
 // The account exit lives inside <small>; never use the first footer link.
 const exit=footer.querySelector('small a');
 if(exit){
  exit.href='#';
  exit.removeAttribute('target');
  exit.dataset.accountLogout='true';
  exit.onclick=e=>{e.preventDefault();onSignOut()};
 }
 if(isAdmin&&!footer.querySelector('[data-platform-link]')){
  const admin=root.createElement('a');
  admin.href='#admin';
  admin.textContent='Administração da Aura';
  admin.dataset.platformLink='true';
  footer.prepend(admin);
 }
}
