import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
const root = ReactDOM.createRoot(document.getElementById("root"));
import { HashRouter } from "react-router-dom";
import GitHubCorners from "@uiw/react-github-corners";

root.render(
  <React.StrictMode>
    <div>
      <HashRouter>
        <GitHubCorners
          position="right"
          href="https://github.com/emanuelef/awesome-selfhosted-stats"
          fixed={true}
        />
        <App />
      </HashRouter>
    </div>
  </React.StrictMode>
);
