// Presentation only: preserve the existing table data, controls and handlers.
export function installInterface(root = document) {
  const enhance = () => {
    for (const table of root.querySelectorAll('table')) {
      if (table.classList.contains('patient-table') || table.closest('#patientsList')) continue;
      const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!headers.length) continue;
      table.classList.add('responsive-table');
      table.setAttribute('role', 'table');
      for (const row of table.querySelectorAll('tr')) {
        row.setAttribute('role', 'row');
        for (const [index, cell] of [...row.children].entries()) {
          cell.setAttribute('role', cell.tagName === 'TH' ? 'columnheader' : 'cell');
          if (cell.tagName !== 'TD' || cell.colSpan > 1 || cell.querySelector(':scope > .mobile-cell-label')) continue;
          const text = headers[index];
          if (text) {
            const label = document.createElement('span');
            label.className = 'mobile-cell-label';
            label.setAttribute('aria-hidden', 'true');
            label.textContent = text.charAt(0) + text.slice(1).toLocaleLowerCase('pt-BR');
            cell.prepend(label);
          }
          if (cell.querySelector('button, a.button')) cell.classList.add('table-actions');
        }
      }
    }
    const dialog = root.querySelector('#modal');
    const title = dialog?.querySelector('h2');
    if (title) {
      if (!title.id) title.id = 'modalTitle';
      if (dialog.getAttribute('aria-labelledby') !== title.id) dialog.setAttribute('aria-labelledby', title.id);
    }
    for (const link of root.querySelectorAll('#nav a')) {
      if (link.classList.contains('active')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };
  // Child changes include asynchronous admin lists and filtered table results.
  const observer = new MutationObserver(enhance);
  observer.observe(root.querySelector('#app') || root.body, {childList: true, subtree: true});
  const modal = root.querySelector('#dialogbody');
  if (modal) observer.observe(modal, {childList: true, subtree: true});
  root.defaultView?.addEventListener('hashchange', enhance);
  root.querySelector('.skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    root.querySelector('#app')?.focus();
  });
  enhance();
  return () => observer.disconnect();
}
