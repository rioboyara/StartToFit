const STORAGE_KEY = "starttofit_state";

const createDefaultState = () => ({
  section: "landing",
  wizardStep: 0,
  onboarding: {
    age: null,
    gender: null,
    weight: null,
    height: null,
    goal: null,
    days: 3,
    level: "beginner"
  },
  program: [],
  currentWeek: 0,
  currentDay: 0,
  execution: {
    exerciseIndex: 0,
    currentSet: 1,
    ratings: [],
    startTime: null
  },
  completedDays: {},
  chat: {
    history: [],
    pending: false
  }
});

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const deepMerge = (base, source) => {
  if (!isObject(base)) {
    return source !== undefined ? source : base;
  }

  const result = { ...base };
  Object.keys(base).forEach((key) => {
    const baseValue = base[key];
    const sourceValue = source?.[key];

    if (Array.isArray(baseValue)) {
      result[key] = Array.isArray(sourceValue) ? sourceValue : baseValue;
      return;
    }

    if (isObject(baseValue)) {
      result[key] = deepMerge(baseValue, sourceValue);
      return;
    }

    result[key] = sourceValue !== undefined ? sourceValue : baseValue;
  });

  if (source) {
    Object.keys(source).forEach((key) => {
      if (!(key in result)) {
        result[key] = source[key];
      }
    });
  }

  return result;
};

const readPersistedState = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Не удалось прочитать состояние", error);
    return null;
  }
};

const writePersistedState = (value) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("Не удалось сохранить состояние", error);
  }
};

let state = deepMerge(createDefaultState(), readPersistedState());
const listeners = new Set();

const clone = (value) => JSON.parse(JSON.stringify(value));

const notify = () => {
  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot));
};

const commit = () => {
  writePersistedState(state);
  notify();
};

export const getState = () => clone(state);

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const apply = (updater) => {
  updater(state);
  commit();
};

const clampWizardStep = (step) => Math.min(Math.max(step, 0), 3);

export const setSection = (section) => {
  apply((draft) => {
    draft.section = section;
  });
};

export const setWizardStep = (step) => {
  apply((draft) => {
    draft.wizardStep = clampWizardStep(step);
  });
};

export const updateOnboardingField = (field, value) => {
  apply((draft) => {
    if (field in draft.onboarding) {
      draft.onboarding[field] = value;
    }
  });
};

export const setProgramWeeks = (weeks) => {
  apply((draft) => {
    draft.program = Array.isArray(weeks) ? weeks : [];
    draft.currentWeek = 0;
    draft.currentDay = 0;
    draft.completedDays = {};
  });
};

export const setCurrentWeek = (weekIndex) => {
  apply((draft) => {
    draft.currentWeek = Math.max(0, weekIndex);
  });
};

export const setCurrentDay = (dayIndex) => {
  apply((draft) => {
    draft.currentDay = Math.max(0, dayIndex);
  });
};

export const markDayCompleted = (weekIndex, dayIndex, payload) => {
  apply((draft) => {
    const key = `${weekIndex}-${dayIndex}`;
    draft.completedDays[key] = {
      ...payload,
      completedAt: new Date().toISOString()
    };
  });
};

export const startExecutionSession = ({ exerciseIndex = 0, currentSet = 1, startTime = new Date().toISOString() } = {}) => {
  apply((draft) => {
    draft.execution = {
      exerciseIndex,
      currentSet,
      ratings: [],
      startTime
    };
  });
};

export const updateExecution = (updates) => {
  apply((draft) => {
    draft.execution = {
      ...draft.execution,
      ...updates
    };
  });
};

export const addExecutionRating = (rating) => {
  apply((draft) => {
    draft.execution.ratings = [...draft.execution.ratings, rating];
  });
};

export const resetExecution = () => {
  apply((draft) => {
    draft.execution = { ...createDefaultState().execution };
  });
};

export const addChatMessage = (message) => {
  if (!message) return;
  apply((draft) => {
    draft.chat.history = [...draft.chat.history, { ...message, timestamp: message.timestamp || new Date().toISOString() }];
  });
};

export const setChatPending = (pending) => {
  apply((draft) => {
    draft.chat.pending = Boolean(pending);
  });
};

export const resetChat = () => {
  apply((draft) => {
    draft.chat = { ...createDefaultState().chat };
  });
};

export const resetState = () => {
  state = createDefaultState();
  commit();
};
