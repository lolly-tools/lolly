// SPDX-License-Identifier: MPL-2.0
export interface LearningTracking {
  read(): Promise<string>;
  save(state: string, completed: boolean, location: string): Promise<void>;
  finish(): Promise<void>;
  readOnly: boolean;
  persistence?: 'browser' | 'session';
}

/** This factory is embedded in the package without authoring dependencies. */
export async function createLearningTracking(
  w: Window,
  target: string,
  activity: string,
  releaseId = ''
): Promise<LearningTracking> {
  if (target === 'preview') {
    let state = '';
    return {
      read: async () => state,
      save: async (v) => {
        state = v;
      },
      finish: async () => {},
      readOnly: false,
    };
  }
  if (target === 'static') {
    let memory = '';
    let db: IDBDatabase;
    try {
      db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = w.indexedDB.open('lolly-learning-progress', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('attempts');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Browser progress storage is busy.'));
      });
    } catch {
      return {
        read: async () => memory,
        save: async (v) => {
          memory = v;
        },
        finish: async () => {},
        readOnly: false,
        persistence: 'session',
      };
    }
    const key = JSON.stringify([w.location.pathname, activity, releaseId]);
    let observed: string | undefined;
    const operation = (value?: string) =>
      new Promise<string>((resolve, reject) => {
        const tx = db.transaction('attempts', value === undefined ? 'readonly' : 'readwrite');
        const store = tx.objectStore('attempts');
        const request = store.get(key);
        let result = '';
        let conflict = false;
        request.onsuccess = () => {
          result = typeof request.result === 'string' ? request.result : '';
          if (value !== undefined) {
            if (observed !== undefined && observed !== result) {
              conflict = true;
              tx.abort();
              return;
            }
            store.put(value, key);
            result = value;
          }
        };
        tx.oncomplete = () => {
          observed = result;
          resolve(result);
        };
        tx.onerror = tx.onabort = () =>
          reject(
            new Error(
              conflict
                ? 'Progress changed in another tab. Reload this course before continuing.'
                : 'Progress could not be saved in this browser. Keep this page open and retry.'
            )
          );
      });
    return {
      read: () => operation(),
      save: async (value) => {
        await operation(value);
      },
      finish: async () => {},
      readOnly: false,
      persistence: 'browser',
    };
  }
  if (!['scorm12', 'scorm2004', 'tincan', 'cmi5'].includes(target))
    throw new Error('Unsupported learning destination.');
  const started = Date.now();
  if (target === 'scorm12' || target === 'scorm2004') {
    const v4 = target === 'scorm2004';
    type Api = Record<string, (...args: string[]) => string>;
    let api: Api | undefined;
    const scan = (initial: Window | null) => {
      let current = initial;
      for (let i = 0; current && i < 20; i++) {
        try {
          const candidate = (current as unknown as Record<string, Api>)[v4 ? 'API_1484_11' : 'API'];
          if (candidate) {
            api = candidate;
            return;
          }
          if (current.parent === current) return;
          current = current.parent;
        } catch {
          return;
        }
      }
    };
    scan(w);
    if (!api) {
      try {
        scan(w.opener as Window | null);
      } catch {
        /* No accessible opener. */
      }
    }
    if (!api)
      throw new Error('The LMS connection is unavailable. Launch this package from your LMS.');
    const call = (v12: string, v2004: string, ...args: string[]) => {
      const fn = api?.[v4 ? v2004 : v12];
      if (!fn) throw new Error('The LMS tracking API is incomplete.');
      return fn.apply(api, args);
    };
    const checked = (a: string, b: string, ...args: string[]) => {
      if (String(call(a, b, ...args)) !== 'true') {
        let code = '';
        try {
          code = String(call('LMSGetLastError', 'GetLastError', ''))
            .replace(/[^0-9]/g, '')
            .slice(0, 8);
        } catch {
          /* Keep the original failure. */
        }
        throw new Error(
          `The LMS did not save this operation${code ? ` (code ${code})` : ''}. Please retry.`
        );
      }
    };
    checked('LMSInitialize', 'Initialize', '');
    const get = (a: string, b: string) => {
      const value = call('LMSGetValue', 'GetValue', v4 ? b : a);
      const code = String(call('LMSGetLastError', 'GetLastError', ''));
      if (code !== '0' && !(v4 && code === '403' && a === 'cmi.suspend_data'))
        throw new Error('The LMS could not read the learning record. Relaunch this module.');
      return value;
    };
    const set = (a: string, b: string, value: string) =>
      checked('LMSSetValue', 'SetValue', v4 ? b : a, value);
    const mode = get('cmi.core.lesson_mode', 'cmi.mode');
    const readOnly = mode === 'review' || mode === 'browse';
    const initialStatus = get('cmi.core.lesson_status', 'cmi.completion_status');
    let completed = ['completed', 'passed'].includes(initialStatus);
    let ended = false;
    const commit = () => checked('LMSCommit', 'Commit', '');
    return {
      readOnly,
      read: async () => get('cmi.suspend_data', 'cmi.suspend_data'),
      save: async (state, done, location) => {
        if (ended) throw new Error('This learning session has ended. Relaunch it from your LMS.');
        if (readOnly) return;
        if (state.length > (v4 ? 64000 : 4096))
          throw new Error('The saved progress exceeds this LMS format limit.');
        set('cmi.suspend_data', 'cmi.suspend_data', state);
        set('cmi.core.lesson_location', 'cmi.location', location);
        completed = completed || done;
        set(
          'cmi.core.lesson_status',
          'cmi.completion_status',
          !v4 && initialStatus === 'passed' ? 'passed' : completed ? 'completed' : 'incomplete'
        );
        set('cmi.core.exit', 'cmi.exit', completed ? (v4 ? 'normal' : '') : 'suspend');
        const cs = Math.max(0, Math.round((Date.now() - started) / 10));
        const pad = (n: number, width = 2) => String(n).padStart(width, '0');
        const duration = v4
          ? `PT${(cs / 100).toFixed(2)}S`
          : `${pad(Math.min(9999, Math.floor(cs / 360000)), 4)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
        set('cmi.core.session_time', 'cmi.session_time', duration);
        commit();
      },
      finish: async () => {
        if (!ended) {
          commit();
          checked('LMSFinish', 'Terminate', '');
          ended = true;
        }
      },
    };
  }

  const cmi5 = target === 'cmi5';
  const params = new URLSearchParams(w.location.search);
  const endpoint = params.get('endpoint');
  const registration = params.get('registration');
  const actorRaw = params.get('actor');
  const activityId = params.get(cmi5 ? 'activityId' : 'activity_id') || activity;
  if (
    !endpoint ||
    !actorRaw ||
    !registration ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registration)
  )
    throw new Error('Launch this package from an LMS that supplies an xAPI registration.');
  const safeUrl = (raw: string) => {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash)
      throw new Error('The LMS supplied an invalid tracking URL.');
    return url;
  };
  const base = safeUrl(endpoint.endsWith('/') ? endpoint : `${endpoint}/`);
  let actor: Record<string, unknown>;
  try {
    actor = JSON.parse(actorRaw) as Record<string, unknown>;
  } catch {
    throw new Error('The LMS supplied an invalid learner identity.');
  }
  if (
    !actor ||
    Array.isArray(actor) ||
    typeof actor !== 'object' ||
    !(actor.account || actor.mbox || actor.mbox_sha1sum || actor.openid)
  )
    throw new Error('The LMS supplied no learner identity.');
  let auth = params.get('auth') || '';
  if (cmi5) {
    const fetchUrl = params.get('fetch');
    if (!fetchUrl) throw new Error('The cmi5 launch is missing its authorization URL.');
    const reply = await w.fetch(safeUrl(fetchUrl), {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!reply.ok)
      throw new Error('The LMS could not authorize this learning session. Relaunch from your LMS.');
    const token = (await reply.json()) as Record<string, unknown>;
    auth = typeof token['auth-token'] === 'string' ? token['auth-token'] : '';
  }
  if (!auth || /[\r\n]/.test(auth))
    throw new Error('The LMS supplied no usable xAPI authorization.');
  const headers = {
    Authorization: auth,
    'X-Experience-API-Version': '1.0.3',
    'Content-Type': 'application/json',
  };
  const query = new URLSearchParams({ activityId, agent: JSON.stringify(actor), registration });
  let etag: string | null = null;
  const stateUrl = (stateId: string) =>
    new URL(`activities/state?${query}&stateId=${encodeURIComponent(stateId)}`, base);
  const fail = (message: string, status = 0) => Object.assign(new Error(message), { status });
  const request = async (url: URL, init: RequestInit, missing = false): Promise<Response> => {
    let response: Response | undefined;
    for (let retry = 0; retry < 3; retry++) {
      try {
        response = await w.fetch(url, {
          ...init,
          headers: { ...headers, ...init.headers },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        response = undefined;
      }
      if (response?.ok || (missing && response?.status === 404)) return response;
      if (response && response.status < 500 && response.status !== 429) break;
      await new Promise((resolve) => w.setTimeout(resolve, 250 * 2 ** retry));
    }
    const status = response?.status || 0;
    if (status === 409 || status === 412)
      throw fail(
        'Progress changed in another session. Relaunch this module before continuing.',
        status
      );
    if (status === 401 || status === 403)
      throw fail('Your LMS authorization has expired. Relaunch this module.', status);
    throw fail('Progress could not be saved to the LMS. Check your connection and retry.', status);
  };
  const statusOf = (error: unknown) => (error as { status?: number }).status || 0;
  let context: Record<string, unknown> = { registration };
  let readOnly = false;
  if (!cmi5 && params.get('grouping'))
    context.contextActivities = { grouping: [{ id: params.get('grouping') }] };
  if (!cmi5 && params.get('activity_platform')) context.platform = params.get('activity_platform');
  if (cmi5) {
    const launch = (await (
      await request(stateUrl('LMS.LaunchData'), { method: 'GET' })
    ).json()) as Record<string, unknown>;
    if (!launch.contextTemplate || typeof launch.contextTemplate !== 'object')
      throw new Error('The LMS supplied no cmi5 launch context.');
    context = { ...launch.contextTemplate };
    if (context.registration && context.registration !== registration)
      throw new Error('The LMS supplied a conflicting registration.');
    context.registration = registration;
    const extensions = context.extensions as Record<string, unknown> | undefined;
    if (!extensions?.['https://w3id.org/xapi/cmi5/context/extensions/sessionid'])
      throw new Error('The LMS supplied no cmi5 session identifier.');
    readOnly = launch.launchMode === 'Browse' || launch.launchMode === 'Review';
    if (!['Normal', 'Browse', 'Review'].includes(String(launch.launchMode)))
      throw new Error('Unsupported cmi5 launch mode.');
    if (!readOnly && launch.moveOn !== 'Completed' && launch.moveOn !== 'NotApplicable')
      throw new Error('This completion-only module requires a Completed move-on setting.');
  }
  const sessionId = cmi5
    ? String(
        (context.extensions as Record<string, unknown>)[
          'https://w3id.org/xapi/cmi5/context/extensions/sessionid'
        ]
      )
    : '';

  // Unsent statements and progress outlive a closed page under this attempt's
  // identity. Authorization and launch URLs are never stored, so a later launch
  // of the same attempt has to authorize any replay. Each statement carries the
  // cmi5 session that made it (empty for Tin Can), and `started` and `ended`
  // list the cmi5 sessions that queued initialized and terminated.
  type Entry = { session: string; body: string };
  type Pending = {
    v: 1;
    statements: Entry[];
    state: string | null;
    base: string | null;
    started: string[];
    ended: string[];
  };
  const blank = (): Pending => ({
    v: 1,
    statements: [],
    state: null,
    base: null,
    started: [],
    ended: [],
  });
  const strings = (list: unknown) =>
    Array.isArray(list) && list.every((s) => typeof s === 'string');
  const valid = (r: Partial<Pending> | undefined): r is Pending =>
    !!r &&
    r.v === 1 &&
    Array.isArray(r.statements) &&
    r.statements.every((s) => !!s && typeof s.session === 'string' && typeof s.body === 'string') &&
    strings(r.started) &&
    strings(r.ended) &&
    (r.state === null || typeof r.state === 'string') &&
    (r.base === null || typeof r.base === 'string');
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, sorted((value as Record<string, unknown>)[k])])
          )
        : value;
  const key = JSON.stringify([
    target,
    base.origin + base.pathname,
    activityId,
    sorted(actor),
    registration,
  ]);
  let memory = blank();
  let db: IDBDatabase | null = null;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = w.indexedDB.open('lolly-learning-recovery', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('pending');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Browser recovery storage is busy.'));
    });
  } catch {
    db = null;
  }
  /** Reads, or changes in one transaction, this attempt's record. Memory takes over if storage fails. */
  const update = (change?: (record: Pending) => void) =>
    new Promise<Pending>((resolve) => {
      let settled = false;
      const local = () => {
        if (settled) return;
        settled = true;
        db = null;
        change?.(memory);
        resolve(memory);
      };
      if (!db) return local();
      let record = blank();
      try {
        const tx = db.transaction('pending', change ? 'readwrite' : 'readonly');
        const store = tx.objectStore('pending');
        const read = store.get(key);
        read.onsuccess = () => {
          record = valid(read.result) ? read.result : blank();
          if (!change) return;
          change(record);
          if (
            record.statements.length ||
            record.state !== null ||
            record.started.length ||
            record.ended.length
          )
            store.put(record, key);
          else store.delete(key);
        };
        tx.oncomplete = () => {
          if (settled) return;
          settled = true;
          memory = record;
          resolve(record);
        };
        tx.onerror = tx.onabort = local;
      } catch {
        local();
      }
    });
  const forget = (...bodies: string[]) =>
    update((record) => {
      record.statements = record.statements.filter((s) => !bodies.includes(s.body));
    });
  const compose = (verb: string) => {
    const ctx = structuredClone(context);
    if (cmi5) {
      const activities = (ctx.contextActivities || {}) as Record<string, unknown>;
      const category = Array.isArray(activities.category) ? [...activities.category] : [];
      for (const id of [
        'https://w3id.org/xapi/cmi5/context/categories/cmi5',
        ...(verb === 'completed' ? ['https://w3id.org/xapi/cmi5/context/categories/moveon'] : []),
      ]) {
        if (!category.some((c) => c.id === id)) category.push({ id });
      }
      ctx.contextActivities = { ...activities, category };
    }
    return JSON.stringify({
      id: w.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor,
      verb: { id: `http://adlnet.gov/expapi/verbs/${verb}` },
      object: { objectType: 'Activity', id: activityId },
      context: ctx,
      ...(['completed', 'terminated'].includes(verb)
        ? {
            result: {
              duration: `PT${((Date.now() - started) / 1000).toFixed(2)}S`,
              ...(verb === 'completed' ? { completion: true } : {}),
            },
          }
        : {}),
    });
  };
  /**
   * Stores a statement before the first send, just ahead of `before` when that
   * is still queued. Every retry then sends the same ID and timestamp.
   */
  const queue = async (verb: string, before = '') => {
    const body = compose(verb);
    await update((record) => {
      const at = before ? record.statements.findIndex((s) => s.body === before) : -1;
      record.statements.splice(at < 0 ? record.statements.length : at, 0, {
        session: sessionId,
        body,
      });
      const marks =
        verb === 'initialized' ? record.started : verb === 'terminated' ? record.ended : null;
      if (cmi5 && marks && !marks.includes(sessionId)) marks.push(sessionId);
    });
    return body;
  };
  const replayed = new Set<string>();
  const forbidden = new Set<string>();
  /**
   * Sends this session's unsent statements in the order they were made,
   * stopping before `until`. Another open cmi5 session's statements stay for
   * that session to send under its own authorization.
   */
  const flush = async (until = '') => {
    for (;;) {
      const entry = (await update()).statements.find(
        (s) => s.session === sessionId && !forbidden.has(s.body)
      );
      if (!entry || entry.body === until) return;
      const { body } = entry;
      const old = replayed.has(body);
      try {
        await request(new URL('statements', base), { method: 'POST', body });
      } catch (error) {
        const status = statusOf(error);
        // A 403 on an older statement may be the LMS closing that statement to
        // this launch. Set it aside and drop it only once the LRS accepts one
        // of this launch's own statements. A 401 says the credentials are bad,
        // so every record stays.
        if (old && status === 403) {
          forbidden.add(body);
          continue;
        }
        // Any other definite refusal cannot be fixed by sending the same
        // statement again, and keeping it would hold back every later one.
        if (status >= 400 && status < 500 && ![401, 403, 408, 429].includes(status)) {
          await forget(body);
          if (old) continue;
        }
        throw error;
      }
      if (old || !forbidden.size) await forget(body);
      else {
        await forget(body, ...forbidden);
        forbidden.clear();
      }
    }
  };

  const recovered = await update((record) => {
    // Another cmi5 session's statements lost their authorization with that session.
    if (cmi5) {
      record.statements = record.statements.filter((s) => s.session === sessionId);
      record.started = record.started.filter((s) => s === sessionId);
      record.ended = record.ended.filter((s) => s === sessionId);
    }
  });
  for (const { body } of recovered.statements) replayed.add(body);
  const progressId = 'lolly.progress.v1';
  if (recovered.statements.length || (!readOnly && recovered.state !== null)) {
    // Reading the attempt's document first proves this launch's authorization
    // before any older record is replayed.
    const current = await request(stateUrl(progressId), { method: 'GET' }, true);
    const pending = recovered.state;
    if (!readOnly && pending !== null) {
      const text = current.status === 404 ? null : await current.text();
      const tag = current.headers.get('ETag');
      // Only the document this copy replaced may be overwritten. Newer LMS progress wins.
      if (
        text !== pending &&
        (text === null ? recovered.base === null : !!tag && tag === recovered.base)
      ) {
        try {
          await request(stateUrl(progressId), {
            method: 'PUT',
            body: pending,
            headers: tag ? { 'If-Match': tag } : { 'If-None-Match': '*' },
          });
        } catch (error) {
          if (statusOf(error) !== 409 && statusOf(error) !== 412) throw error;
        }
      }
      await update((record) => {
        if (record.state === pending) record.state = record.base = null;
      });
    }
  }
  if (cmi5 && recovered.ended.includes(sessionId)) {
    // This session was already ending: deliver its own records, never new ones.
    await flush().catch(() => {});
    throw new Error('This learning session has ended. Relaunch it from your LMS.');
  }
  const opening = cmi5 && recovered.started.includes(sessionId) ? '' : await queue('initialized');
  try {
    await flush();
  } catch (error) {
    // A launch that cannot connect records nothing of its own.
    if (opening)
      await update((record) => {
        record.statements = record.statements.filter((s) => s.body !== opening);
        record.started = record.started.filter((s) => s !== sessionId);
      });
    throw error;
  }
  let terminated = false;
  let completionSent = false;
  let closing = '';
  return {
    readOnly,
    read: async () => {
      const r = await request(stateUrl(progressId), { method: 'GET' }, true);
      etag = r.headers.get('ETag');
      return r.status === 404 ? '' : await r.text();
    },
    save: async (state, completed) => {
      if (terminated) throw new Error('This learning session has ended.');
      if (readOnly) return;
      await update((record) => {
        record.state = state;
        record.base = etag;
      });
      const r = await request(stateUrl(progressId), {
        method: 'PUT',
        body: state,
        headers: etag ? { 'If-Match': etag } : { 'If-None-Match': '*' },
      });
      etag = r.headers.get('ETag');
      if (!etag) {
        const check = await request(stateUrl(progressId), { method: 'GET' });
        etag = check.headers.get('ETag');
      }
      await update((record) => {
        if (record.state === state) record.state = record.base = null;
      });
      // After a failed Exit, completion still goes ahead of the queued terminated.
      if (completed && !completionSent) {
        await queue('completed', closing);
        completionSent = true;
      }
      await flush(closing);
    },
    finish: async () => {
      if (terminated) return;
      if (!closing) closing = await queue('terminated');
      await flush();
      terminated = true;
    },
  };
}
