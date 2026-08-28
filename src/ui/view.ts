const appMarkup = `
  <div class="ambient ambient-one" aria-hidden="true"></div>
  <div class="ambient ambient-two" aria-hidden="true"></div>
  <div class="app-shell">
    <header class="topbar">
      <a class="mini-mark" href="./" aria-label="Pinch home">
        <span class="mini-mark-dot" aria-hidden="true"></span>
        <span>Pinch</span>
      </a>
      <button class="theme-toggle" data-testid="theme-toggle" type="button" aria-label="Toggle color theme">
        <span class="theme-orbit" aria-hidden="true"><span></span></span>
        <span class="theme-label">Theme</span>
      </button>
    </header>

    <main class="main-content">
      <section class="hero" aria-labelledby="pinch-title">
        <p class="eyebrow"><span></span> Public Pins, locally handled</p>
        <h1 id="pinch-title">Pinch<span class="title-dot">.</span></h1>
        <p class="tagline">Pinterest video <span aria-hidden="true">→</span> MP4</p>

        <form class="resolve-form" data-testid="resolve-form" novalidate>
          <label class="sr-only" for="pin-url">Pinterest video URL</label>
          <div class="input-frame">
            <span class="link-glyph" aria-hidden="true"></span>
            <input
              id="pin-url"
              data-testid="url-input"
              type="url"
              inputmode="url"
              autocomplete="url"
              autocapitalize="off"
              spellcheck="false"
              maxlength="2048"
              placeholder="Paste a Pinterest URL…"
              required
            />
            <button class="resolve-button" data-testid="resolve-button" type="submit">
              <span>Get MP4</span><span class="button-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </form>

        <div class="trust-line" aria-label="Privacy promises">
          <span>No login</span><i></i><span>No uploads</span><i></i><span>No analytics</span>
        </div>
      </section>

      <section class="feedback" aria-live="polite" aria-atomic="true">
        <div class="loading-state" data-testid="loading-state" hidden>
          <span class="loading-mark" aria-hidden="true"><i></i><i></i></span>
          <span>Finding the best source…</span>
        </div>
        <div class="error-state" data-testid="error-state" hidden>
          <span class="error-mark" aria-hidden="true">!</span>
          <div>
            <strong>Couldn’t get that video</strong>
            <p data-testid="error-message"></p>
          </div>
        </div>
      </section>

      <section class="result-card" data-testid="result-card" hidden aria-label="Resolved video">
        <div class="preview-column">
          <div class="preview-halo" aria-hidden="true"></div>
          <video data-testid="video-preview" controls playsinline preload="metadata"></video>
        </div>
        <div class="result-details">
          <p class="result-kicker"><span></span> Best source found</p>
          <h2 data-testid="pin-title"></h2>
          <p class="media-meta" data-testid="media-meta"></p>
          <p class="action-help" data-testid="action-help"></p>
          <div class="action-slot" data-testid="action-slot"></div>
          <button class="start-over" data-testid="start-over" type="button">Use another URL</button>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <p>Media stays between you and Pinterest.</p>
      <p>Download only content you have permission to use.</p>
    </footer>
  </div>
`;

export interface AppView {
  readonly root: HTMLElement;
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly resolveButton: HTMLButtonElement;
  readonly loading: HTMLElement;
  readonly errorState: HTMLElement;
  readonly errorMessage: HTMLElement;
  readonly resultCard: HTMLElement;
  readonly preview: HTMLVideoElement;
  readonly title: HTMLElement;
  readonly meta: HTMLElement;
  readonly help: HTMLElement;
  readonly actionSlot: HTMLElement;
  readonly startOver: HTMLButtonElement;
  readonly themeToggle: HTMLButtonElement;
}

const requiredElement = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Pinch UI is missing ${selector}`);
  }
  return element;
};

export const createAppView = (root: HTMLElement): AppView => {
  root.innerHTML = appMarkup;
  return {
    root,
    form: requiredElement(root, '[data-testid="resolve-form"]'),
    input: requiredElement(root, '[data-testid="url-input"]'),
    resolveButton: requiredElement(root, '[data-testid="resolve-button"]'),
    loading: requiredElement(root, '[data-testid="loading-state"]'),
    errorState: requiredElement(root, '[data-testid="error-state"]'),
    errorMessage: requiredElement(root, '[data-testid="error-message"]'),
    resultCard: requiredElement(root, '[data-testid="result-card"]'),
    preview: requiredElement(root, '[data-testid="video-preview"]'),
    title: requiredElement(root, '[data-testid="pin-title"]'),
    meta: requiredElement(root, '[data-testid="media-meta"]'),
    help: requiredElement(root, '[data-testid="action-help"]'),
    actionSlot: requiredElement(root, '[data-testid="action-slot"]'),
    startOver: requiredElement(root, '[data-testid="start-over"]'),
    themeToggle: requiredElement(root, '[data-testid="theme-toggle"]'),
  };
};
