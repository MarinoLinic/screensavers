// Kept local so standalone project launchers still work.
const project = document.currentScript.dataset.project;
if (location.pathname.includes('/' + project + '/')) {
  const strip = document.querySelector('#keystrip, .toolbar, #controls .button-row');
  if (strip) {
    const home = document.createElement('a');
    home.className = 'collection-home';
    home.href = '../index.html';
    home.textContent = '← Library';
    home.setAttribute('aria-label', 'Return to screensaver library');
    strip.prepend(home);
    const intro = document.querySelector('#intro .panel');
    if (intro) {
      const back = home.cloneNode(true);
      back.className = 'collection-return';
      intro.append(back);
    }
  }
}
