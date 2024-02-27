import {
  RouteRecordRaw,
  Router,
  createRouter,
  createWebHistory,
} from "vue-router";

export let router: Router;

export function setupRouter(): Router {
  // setup routes
  const routes: RouteRecordRaw[] = [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
  ];

  // create router instance
  router = createRouter({
    history: createWebHistory(),
    routes,
  });

  return router;
}
