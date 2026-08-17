import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import router from './router';

const app = createApp(App).use(router);

// Wait for the router's first navigation (which runs the auth guard and
// resolves the session) before mounting — otherwise NavBar renders once
// with user still null, then again once fetchMe() resolves, flashing the
// logged-out nav for an authenticated user on every hard reload.
router.isReady().then(() => app.mount('#app'));
