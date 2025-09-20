import dns from 'node:dns';

let applied = false;

export function ensureLocalhostDnsResolution() {
  if (applied) return;
  applied = true;

  const originalLookup = dns.lookup;
  // @ts-expect-error - We're patching the DNS lookup function
  dns.lookup = function patchedLookup(
    hostname: string,
    options: any,
    callback?: any
  ) {
    if (hostname === 'localhost') {
      let family = 4;
      let cb = callback;

      if (typeof options === 'function') {
        cb = options;
      } else if (typeof options === 'number') {
        family = options === 6 ? 6 : 4;
      } else if (typeof options === 'object' && options !== null) {
        const candidate = Reflect.get(options, 'family');
        family = candidate === 6 ? 6 : 4;
      }

      const address = family === 6 ? '::1' : '127.0.0.1';
      const invoke = cb ?? (() => {});
      process.nextTick(() => invoke(null, address, family));
      return;
    }

    return originalLookup.apply(this, arguments as any);
  };

  if (dns.promises?.lookup) {
    const originalPromisedLookup = dns.promises.lookup.bind(dns.promises);
    dns.promises.lookup = (async (hostname: string, options?: unknown) => {
      if (hostname === 'localhost') {
        let family = 4;
        if (typeof options === 'number') {
          family = options === 6 ? 6 : 4;
        } else if (
          typeof options === 'object' &&
          options !== null &&
          'family' in options
        ) {
          const candidate = Reflect.get(
            options as { family?: number },
            'family'
          );
          family = candidate === 6 ? 6 : 4;
        }

        const address = family === 6 ? '::1' : '127.0.0.1';
        return { address, family };
      }

      return originalPromisedLookup(hostname, options as never);
    }) as typeof dns.promises.lookup;
  }
}

ensureLocalhostDnsResolution();
