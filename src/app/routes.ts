import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import ThankYou from "./pages/ThankYou";
import Root from "./Root";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "features", Component: Features },
      { path: "how-it-works", Component: HowItWorks },
      { path: "pricing", Component: Pricing },
      { path: "about", Component: About },
      { path: "faq", Component: FAQ },
      { path: "thank-you", Component: ThankYou },
    ],
  },
]);
