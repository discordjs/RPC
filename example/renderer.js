'use strict';

/* eslint-env browser */

const { webFrame } = require('electron');

const snek = document.getElementById('snek');
const counter = document.getElementById('boops');

webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);

window.boops = 0;
function boop() {
  window.boops += 1;
  counter.innerHTML = `${window.boops} BOOPS`;
}

snek.onmousedown = () => {
  snek.style['font-size'] = '550%';
  boop();
};

snek.onmouseup = () => {
  snek.style['font-size'] = '500%';
};
