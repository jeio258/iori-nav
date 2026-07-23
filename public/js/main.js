// public/js/main.js
// 首页入口 - ES module bundle entry

import './home-ui.js';
import './home-cards.js';
import './home-search.js';
import './home-submit.js';
import './home-category-nav.js';

document.addEventListener('DOMContentLoaded', function () {
  const Home = window.IoriHome = window.IoriHome || {};

  Home.initCommonUi?.();

  if (typeof Home.createCardController === 'function') {
    Home.cardController = Home.createCardController();
    Home.cardController.init();
  }

  Home.initSubmission?.();
  Home.initSearch?.();
  Home.initCategoryNavigation?.();

  requestAnimationFrame(() => {
    document.body.classList.add('app-ready');
  });
});
