import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type InstallModule = typeof import('../../services/installPrompt');

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

let standalone = false;
let install: InstallModule;
const added: [string, EventListener][] = [];

function installPromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(event, {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
}

beforeEach(async () => {
  standalone = false;
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID);
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: query === '(display-mode: standalone)' && standalone,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  const originalAdd = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    added.push([type, listener as EventListener]);
    originalAdd(type, listener, options);
  });
  // El estado vive en el módulo: uno nuevo por test.
  vi.resetModules();
  install = await import('../../services/installPrompt');
  install.initInstallPrompt();
});

afterEach(() => {
  added.forEach(([type, listener]) => window.removeEventListener(type, listener));
  added.length = 0;
  vi.restoreAllMocks();
});

it('offers nothing until the browser allows installing', () => {
  expect(install.installState()).toBe('unavailable');
});

it('keeps the browser install prompt and opens it on demand', async () => {
  const onChange = vi.fn();
  install.subscribeInstallState(onChange);
  const event = installPromptEvent('accepted');

  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
  expect(onChange).toHaveBeenCalled();
  expect(install.installState()).toBe('native');

  await expect(install.promptInstall()).resolves.toBe('accepted');
  expect(event.prompt).toHaveBeenCalledTimes(1);
  // El evento solo vale una vez.
  expect(install.installState()).toBe('unavailable');
  await expect(install.promptInstall()).resolves.toBe('unavailable');
});

it('reports a dismissed prompt', async () => {
  window.dispatchEvent(installPromptEvent('dismissed'));

  await expect(install.promptInstall()).resolves.toBe('dismissed');
});

it('hides the install option once the app is installed', () => {
  window.dispatchEvent(installPromptEvent('accepted'));
  window.dispatchEvent(new Event('appinstalled'));

  expect(install.installState()).toBe('installed');
});

it('treats the standalone display mode as installed', () => {
  standalone = true;
  window.dispatchEvent(installPromptEvent('accepted'));

  expect(install.installState()).toBe('installed');
});

it('shows the manual steps on iPhone and nothing once added to the home screen', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
  expect(install.installState()).toBe('ios');

  Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
  try {
    expect(install.installState()).toBe('installed');
  } finally {
    Reflect.deleteProperty(navigator, 'standalone');
  }
});

it('sends people inside another app’s browser to the real browser first', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(`${IPHONE} Instagram 350.0.0`);

  expect(install.installState()).toBe('in-app');
});

it.each([
  [`${IPHONE} Instagram 350.0.0.32.109 (iPhone15,2; iOS 18_0)`, true],
  [`${IPHONE} [FBAN/FBIOS;FBAV/480.0]`, true],
  [`${ANDROID} [FB_IAB/FB4A;FBAV/480.0]`, true],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) GSA/350.0 Mobile/15E148', true],
  [IPHONE, false],
  [ANDROID, false],
])('detects in-app browsers: %s', (userAgent, expected) => {
  expect(install.isInAppBrowser(userAgent)).toBe(expected);
});

it.each([
  [IPHONE, 'bottom'],
  [IPHONE.replace('Version/18.0', 'Version/26.0'), 'bottom-menu'],
  [IPHONE.replace('Version/18.0', 'Version/27.0'), 'address-menu'],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    'top-right',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    'top-right',
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
    'menu',
  ],
])('finds the Share button for %s', (userAgent, place) => {
  expect(install.shareButtonPlace(userAgent)).toBe(place);
});
