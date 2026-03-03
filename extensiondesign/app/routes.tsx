import { createBrowserRouter } from "react-router";
import { PopupView } from "./components/popup-view";
import { SettingsView } from "./components/settings-view";
import { FloatingPanelView } from "./components/floating-panel-view";
import { DocumentationView } from "./components/documentation-view";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: PopupView,
  },
  {
    path: "/settings",
    Component: SettingsView,
  },
  {
    path: "/floating-panel",
    Component: FloatingPanelView,
  },
  {
    path: "/documentation",
    Component: DocumentationView,
  },
]);
