import { getState, updateOnboardingField, setWizardStep } from "./state.js";
import { buildProgram } from "./program.js";

const onboardingSteps = [
  {
    id: "basics",
    title: "Основные данные",
    required: ["age", "gender"],
    render: (state) => {
      const { age = 18, gender } = state.onboarding;
      return `
        <div class="wizard-step">
          <div class="input-stepper" data-field="age">
            <button type="button" class="stepper-btn" data-action="decrement">-</button>
            <span class="stepper-value">${age}</span>
            <button type="button" class="stepper-btn" data-action="increment">+</button>
          </div>
          <div class="selection-cards" data-field="gender">
            <button type="button" class="card ${gender === "female" ? "active" : ""}" data-value="female">♀</button>
            <button type="button" class="card ${gender === "male" ? "active" : ""}" data-value="male">♂</button>
          </div>
        </div>
      `;
    }
  },
  {
    id: "metrics",
    title: "Параметры",
    required: ["weight", "height"],
    render: (state) => {
      const { weight = 60, height = 165 } = state.onboarding;
      return `
        <div class="wizard-step">
          <label class="slider-field" data-field="weight">
            <span>Вес: <strong>${weight} кг</strong></span>
            <input type="range" min="40" max="140" value="${weight}" />
          </label>
          <label class="slider-field" data-field="height">
            <span>Рост: <strong>${height} см</strong></span>
            <input type="range" min="140" max="210" value="${height}" />
          </label>
        </div>
      `;
    }
  },
  {
    id: "goal",
    title: "Цель",
    required: ["goal"],
    render: (state) => {
      const { goal } = state.onboarding;
      const cards = [
        { value: "loss", label: "🔥 Похудение" },
        { value: "muscle", label: "💪 Мышцы" },
        { value: "shape", label: "⚡ Форма" }
      ];
      return `
        <div class="wizard-step selection-grid" data-field="goal">
          ${cards
            .map(
              (card) => `
                <button type="button" class="card ${goal === card.value ? "active" : ""}" data-value="${card.value}">
                  <span class="selection-icon">${card.label.slice(0, 2)}</span>
                  <span>${card.label.slice(2).trim()}</span>
                </button>
              `
            )
            .join("")}
        </div>
      `;
    }
  },
  {
    id: "schedule",
    title: "График",
    required: ["days", "level"],
    render: (state) => {
      const { days = 3, level = "beginner" } = state.onboarding;
      return `
        <div class="wizard-step">
          <div class="pill-group" data-field="days">
            ${[2, 3, 4, 5]
              .map((value) => `<button type="button" class="pill ${days === value ? "active" : ""}" data-value="${value}">${value} раза</button>`)
              .join("")}
          </div>
          <div class="selection-cards" data-field="level">
            ${[
              { value: "beginner", label: "Новичок" },
              { value: "intermediate", label: "Уверенно" },
              { value: "advanced", label: "Опыт" }
            ]
              .map(
                (option) => `<button type="button" class="card ${level === option.value ? "active" : ""}" data-value="${option.value}">${option.label}</button>`
              )
              .join("")}
          </div>
        </div>
      `;
    }
  }
];

const validators = {
  basics: (onboarding) => onboarding.age >= 14 && Boolean(onboarding.gender),
  metrics: (onboarding) => onboarding.weight > 0 && onboarding.height > 0,
  goal: (onboarding) => Boolean(onboarding.goal),
  schedule: (onboarding) => onboarding.days >= 2 && Boolean(onboarding.level)
};

const bindStepperControls = (container) => {
  container.querySelectorAll(".input-stepper")?.forEach((stepper) => {
    const field = stepper.dataset.field;
    const valueEl = stepper.querySelector(".stepper-value");
    stepper.querySelectorAll(".stepper-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const delta = button.dataset.action === "increment" ? 1 : -1;
        const current = Number(valueEl.textContent) || 0;
        const next = Math.min(Math.max(current + delta, 14), 80);
        valueEl.textContent = next;
        updateOnboardingField(field, next);
      });
    });
  });
};

const bindRangeControls = (container) => {
  container.querySelectorAll(".slider-field").forEach((fieldWrapper) => {
    const field = fieldWrapper.dataset.field;
    const valueEl = fieldWrapper.querySelector("strong");
    const input = fieldWrapper.querySelector("input");
    input.addEventListener("input", (event) => {
      const nextValue = Number(event.target.value);
      valueEl.textContent = `${nextValue} ${field === "weight" ? "кг" : "см"}`;
      updateOnboardingField(field, nextValue);
    });
  });
};

const bindSelectionCards = (container) => {
  container.querySelectorAll("[data-field]").forEach((group) => {
    if (!group.matches(".selection-cards, .pill-group, .selection-grid")) {
      return;
    }
    const field = group.dataset.field;
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.value;
        updateOnboardingField(field, field === "days" ? Number(value) : value);
      });
    });
  });
};

const attachHandlers = (container) => {
  bindStepperControls(container);
  bindRangeControls(container);
  bindSelectionCards(container);
};

export const renderWizard = (container, onChange) => {
  const render = () => {
    const state = getState();
    const step = onboardingSteps[state.wizardStep];
    container.innerHTML = `
      <header class="wizard-header">
        <h3>${step.title}</h3>
      </header>
      ${step.render(state)}
    `;
    attachHandlers(container);
    if (typeof onChange === "function") {
      onChange(state);
    }
  };

  render();
  return getState().wizardStep;
};

export const validateCurrentStep = () => {
  const state = getState();
  const step = onboardingSteps[state.wizardStep];
  const validator = validators[step.id];
  return validator ? validator(state.onboarding) : true;
};

export const goToStep = (stepIndex) => {
  if (stepIndex < 0 || stepIndex >= onboardingSteps.length) return false;
  setWizardStep(stepIndex);
  return true;
};

export const nextStep = () => {
  if (!validateCurrentStep()) return false;
  const state = getState();
  if (state.wizardStep >= onboardingSteps.length - 1) return false;
  setWizardStep(state.wizardStep + 1);
  return true;
};

export const prevStep = () => {
  const state = getState();
  if (state.wizardStep <= 0) return false;
  setWizardStep(state.wizardStep - 1);
  return true;
};

export const submitWizard = () => {
  if (!validateCurrentStep()) {
    return null;
  }
  const { onboarding } = getState();
  return buildProgram(onboarding);
};

export { onboardingSteps };
