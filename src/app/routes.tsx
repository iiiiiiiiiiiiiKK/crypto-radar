import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

export function AppRoutes() {
  // The basename keeps deep links working under the GitHub Pages sub-path.
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
  return (
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  );
}
