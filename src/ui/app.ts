import { PinchError } from "../core/errors";
import { selectBestSource } from "../core/select";
import type { PinVideo, VideoSource } from "../core/types";
import { createMp4Action } from "../media/download";
import type { BlobDownloadAction, Mp4Action } from "../media/types";
import type { AppDependencies, MountedApp } from "./types";
import { createAppView, type AppView } from "./view";

interface ResolvedPin {
  readonly action: Mp4Action;
  readonly pin: PinVideo;
  readonly source: VideoSource;
}

interface RequestLifecycle {
  readonly abort: () => void;
  readonly begin: () => AbortController;
  readonly finish: (controller: AbortController) => void;
}

const userMessage = (error: unknown): string =>
  error instanceof PinchError
    ? error.message
    : "Something went wrong. Please try again.";

const sourceDescription = (source: VideoSource): string => {
  const dimensions = source.width && source.height
    ? `${source.width} × ${source.height}`
    : "Original size";
  return `${dimensions} · ${source.type.toUpperCase()} · Best available quality`;
};

const storedTheme = (): "light" | "dark" => {
  try {
    return localStorage.getItem("pinch-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const persistTheme = (theme: "light" | "dark"): void => {
  try {
    localStorage.setItem("pinch-theme", theme);
  } catch {
    // A blocked storage API should not prevent the visual theme from changing.
  }
};

const setBusy = (view: AppView, busy: boolean): void => {
  view.loading.hidden = !busy;
  view.resolveButton.disabled = busy;
  const label = view.resolveButton.querySelector("span");
  if (label) {
    label.textContent = busy ? "Resolving…" : "Get MP4";
  }
};

const showError = (view: AppView, message: string): void => {
  setBusy(view, false);
  view.resultCard.hidden = true;
  view.errorMessage.textContent = message;
  view.errorState.hidden = false;
};

const createRequestLifecycle = (): RequestLifecycle => {
  let activeRequest: AbortController | undefined;
  return {
    abort: () => {
      activeRequest?.abort();
      activeRequest = undefined;
    },
    begin: () => {
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;
      return controller;
    },
    finish: (controller) => {
      if (activeRequest === controller) {
        activeRequest = undefined;
      }
    },
  };
};

const resolvePin = async (
  dependencies: AppDependencies,
  url: string,
  controller: AbortController,
): Promise<ResolvedPin> => {
  const pin = await dependencies.resolver.resolve(url, { signal: controller.signal });
  const source = selectBestSource(pin.sources);
  if (!source) {
    throw new PinchError("no_video", "This Pin does not contain a video");
  }
  if (source.type === "hls") {
    const capability = await dependencies.assessHlsSource(source, {
      signal: controller.signal,
    });
    throw new PinchError("hls_unsupported", capability.message);
  }

  const access = await dependencies.probeMediaAccess(source.url, {
    signal: controller.signal,
  });
  return {
    action: createMp4Action(pin.pinId, source, access),
    pin,
    source,
  };
};

const runBlobDownload = async (
  view: AppView,
  dependencies: AppDependencies,
  action: BlobDownloadAction,
): Promise<void> => {
  const button = view.actionSlot.querySelector<HTMLButtonElement>(
    '[data-testid="media-action"]',
  );
  if (!button) {
    throw new Error("Pinch UI is missing its media action");
  }
  button.disabled = true;
  button.textContent = "Downloading…";
  try {
    await dependencies.downloadReadableMp4(action);
    button.textContent = "Downloaded";
  } catch (error) {
    showError(view, userMessage(error));
  } finally {
    button.disabled = false;
  }
};

const renderAction = (
  view: AppView,
  action: Mp4Action,
  onDownload: (action: BlobDownloadAction) => void,
): void => {
  view.help.textContent = action.help;
  const document = view.root.ownerDocument;
  if (action.kind === "direct-open") {
    const link = document.createElement("a");
    link.className = "media-action";
    link.dataset.testid = "media-action";
    link.href = action.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = action.label;
    view.actionSlot.replaceChildren(link);
    return;
  }

  const button = document.createElement("button");
  button.className = "media-action";
  button.dataset.testid = "media-action";
  button.type = "button";
  button.textContent = action.label;
  button.addEventListener("click", () => onDownload(action));
  view.actionSlot.replaceChildren(button);
};

const renderResult = (
  view: AppView,
  result: ResolvedPin,
  onDownload: (action: BlobDownloadAction) => void,
): void => {
  setBusy(view, false);
  view.errorState.hidden = true;
  view.title.textContent = result.pin.title ?? "Pinterest video";
  view.meta.textContent = sourceDescription(result.source);
  view.preview.src = result.source.url;
  view.preview.poster = result.pin.thumbnail ?? "";
  renderAction(view, result.action, onDownload);
  view.resultCard.hidden = false;
};

const createSubmitHandler = (
  view: AppView,
  dependencies: AppDependencies,
  requests: RequestLifecycle,
  onDownload: (action: BlobDownloadAction) => void,
): ((event: SubmitEvent) => void) => (event) => {
  event.preventDefault();
  const controller = requests.begin();
  view.errorState.hidden = true;
  view.resultCard.hidden = true;
  setBusy(view, true);

  void resolvePin(dependencies, view.input.value, controller)
    .then((result) => {
      if (!controller.signal.aborted) {
        renderResult(view, result, onDownload);
      }
    })
    .catch((error: unknown) => {
      if (!controller.signal.aborted) {
        showError(view, userMessage(error));
      }
    })
    .finally(() => requests.finish(controller));
};

const createResetHandler = (
  view: AppView,
  requests: RequestLifecycle,
): (() => void) => () => {
  requests.abort();
  view.preview.removeAttribute("src");
  view.preview.removeAttribute("poster");
  view.preview.load();
  view.resultCard.hidden = true;
  view.errorState.hidden = true;
  view.input.value = "";
  view.input.focus();
};

const toggleTheme = (): void => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  persistTheme(next);
};

export const mountPinchApp = (
  root: HTMLElement,
  dependencies: AppDependencies,
): MountedApp => {
  const view = createAppView(root);
  const requests = createRequestLifecycle();
  const onDownload = (action: BlobDownloadAction): void => {
    void runBlobDownload(view, dependencies, action);
  };
  const submit = createSubmitHandler(view, dependencies, requests, onDownload);
  const reset = createResetHandler(view, requests);

  document.documentElement.dataset.theme = storedTheme();
  view.form.addEventListener("submit", submit);
  view.startOver.addEventListener("click", reset);
  view.themeToggle.addEventListener("click", toggleTheme);

  return {
    destroy: () => {
      requests.abort();
      view.form.removeEventListener("submit", submit);
      view.startOver.removeEventListener("click", reset);
      view.themeToggle.removeEventListener("click", toggleTheme);
      root.replaceChildren();
    },
  };
};
