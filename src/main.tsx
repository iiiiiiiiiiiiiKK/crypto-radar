import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoutes } from "./app/routes";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root is missing");

createRoot(container).render(
  <StrictMode>
    <AppRoutes />
  </StrictMode>,
);
