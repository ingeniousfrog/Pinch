import { BrowserResolver } from "./core/browser-resolver";
import { downloadReadableMp4, probeMediaAccess } from "./media/download";
import { assessHlsSource } from "./media/hls";
import "./styles.css";
import { mountPinchApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Pinch could not find its application root");
}

mountPinchApp(root, {
  resolver: new BrowserResolver(),
  probeMediaAccess,
  assessHlsSource,
  downloadReadableMp4,
});

