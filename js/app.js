import {
  getState,
  subscribe,
  setSection,
  setCurrentWeek,
  setCurrentDay
} from "./state.js";
import {
  renderWizard,
  nextStep,
  prevStep,
  submitWizard,
  validateCurrentStep,
  onboardingSteps
} from "./wizard.js";
import { getGoalLabel, getLevelLabel } from "./program.js";
import { createWorkoutController } from "./workout.js";
import { createChatController } from "./chat.js";

const sections = [
  "landing",
  "onboarding",
  "loading",
  "program",
  "workout",
  "execution",
  "completion"
];
const sectionRefs = sections.reduce(
  (acc, id) => ({
    ...acc,
    [id]: document.getElementById(id)
  }),
  {}
);

const wizardContainer = document.getElementById("wizard-steps");
const wizardPrev = document.getElementById("wizard-prev");
const wizardNext = document.getElementById("wizard-next");
const wizardProgress = document.getElementById("wizard-progress");
const startOnboardingBtn = document.getElementById("start-onboarding");

const weekTabs = document.getElementById("week-tabs");
const goalLabel = document.querySelector("[data-program-goal]");
const levelLabel = document.querySelector("[data-program-level]");

const workoutElements = {
  daysGrid: document.getElementById("days-grid"),
  workoutTitle: document.getElementById("workout-title"),
  workoutSubtitle: document.getElementById("workout-subtitle"),
  tipsCard: document.getElementById("tips-card"),
  exerciseList: document.getElementById("exercise-list"),
  executionDots: document.getElementById("execution-dots"),
  executionCard: document.getElementById("execution-card"),
  completionStats: document.getElementById("completion-stats"),
  completionSummary: document.getElementById("completion-summary"),
  completionMessage: document.getElementById("completion-message")
};

const workoutController = createWorkoutController({
  state: {
    get onboarding() {
      return getState().onboarding;
    }
  },
  elements: workoutElements,
  navigateTo: (sectionId) => setSection(sectionId)
});

createChatController({
  elements: {
    chatModal: document.getElementById("chat-modal"),
    chatBody: document.getElementById("chat-body"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    chatOpen: document.getElementById("chat-open"),
    chatClose: document.getElementById("chat-close")
  }
});

const toggleSections = (activeId) => {
  sections.forEach((id) => {
    const element = sectionRefs[id];
    if (!element) return;
    const isActive = id === activeId;
    element.classList.toggle("hidden", !isActive);
    element.classList.toggle("active", isActive);
    element.setAttribute("aria-hidden", String(!isActive));
  });
};

const updateWizardProgress = () => {
  if (!wizardProgress) return;
  const { wizardStep } = getState();
  const dots = wizardProgress.querySelectorAll(".dot");
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === wizardStep);
  });
};

const updateWizardControls = () => {
  const state = getState();
  const isLastStep = state.wizardStep === onboardingSteps.length - 1;

  if (wizardPrev) {
    wizardPrev.disabled = state.wizardStep === 0;
  }

  if (wizardNext) {
    wizardNext.textContent = isLastStep ? "Собрать программу" : "Далее";
    wizardNext.disabled = !validateCurrentStep();
  }
};

const updateProgramHeader = () => {
  const { onboarding } = getState();
  if (goalLabel) {
    goalLabel.textContent = `Цель: ${getGoalLabel(onboarding.goal)}`;
    goalLabel.classList.toggle("active", Boolean(onboarding.goal));
  }
  if (levelLabel) {
    levelLabel.textContent = `Уровень: ${getLevelLabel(onboarding.level)}`;
  }
};

const renderWeekTabs = () => {
  if (!weekTabs) return;
  const { program, currentWeek } = getState();
  if (!program?.length) {
    weekTabs.innerHTML = "";
    return;
  }

  weekTabs.innerHTML = program
    .map(
      (week, index) => `
        <button type="button" class="tab ${index === currentWeek ? "active" : ""}" data-week="${index}">
          ${week.title}
        </button>
      `
    )
    .join("");

  weekTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const weekIndex = Number(button.dataset.week);
      setCurrentWeek(weekIndex);
      setCurrentDay(0);
      workoutController.renderDayList();
      renderWeekTabs();
    });
  });
};

const setLoadingText = (step) => {
  const textItems = document.querySelectorAll("#loading .loading-text p");
  textItems.forEach((item, index) => {
    item.classList.toggle("active", index === step);
  });
};

const simulateLoading = async () => {
  const bar = document.getElementById("loading-progress");
  const checkpoints = [18, 45, 72, 100];

  for (let index = 0; index < checkpoints.length; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const progress = checkpoints[index];
    if (bar) {
      bar.style.width = `${progress}%`;
    }
    setLoadingText(index);
  }
};

const handleProgramGeneration = async () => {
  const programBuilt = submitWizard();
  if (!programBuilt) return;
  setSection("loading");
  await simulateLoading();
  workoutController.renderDayList();
  renderWeekTabs();
  updateProgramHeader();
  setSection("program");
};

const handleWizardNext = () => {
  const state = getState();
  const isLastStep = state.wizardStep === onboardingSteps.length - 1;
  if (!isLastStep) {
    if (nextStep()) {
      renderWizard(wizardContainer, updateWizardControls);
      updateWizardControls();
      updateWizardProgress();
    }
    return;
  }
  handleProgramGeneration();
};

const handleWizardPrev = () => {
  if (prevStep()) {
    renderWizard(wizardContainer, updateWizardControls);
    updateWizardControls();
    updateWizardProgress();
  }
};

const bindNavigation = () => {
  startOnboardingBtn?.addEventListener("click", () => {
    setSection("onboarding");
    renderWizard(wizardContainer, updateWizardControls);
    updateWizardControls();
    updateWizardProgress();
  });

  wizardNext?.addEventListener("click", handleWizardNext);
  wizardPrev?.addEventListener("click", handleWizardPrev);

  document.getElementById("back-to-program")?.addEventListener("click", () => setSection("program"));
  document.getElementById("start-workout")?.addEventListener("click", () => workoutController.startWorkoutExecution());
  document.getElementById("completion-finish")?.addEventListener("click", () => setSection("program"));
};

const bindExecutionRatings = () => {
  const ratingContainer = document.getElementById("execution-rating");
  if (!ratingContainer) return;
  ratingContainer.querySelectorAll("[data-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      workoutController.handleExerciseRating(button.dataset.rating);
    });
  });
};

subscribe(() => {
  const state = getState();
  toggleSections(state.section);
  updateWizardControls();
  updateWizardProgress();
  updateProgramHeader();
  if (state.program?.length) {
    renderWeekTabs();
    workoutController.renderDayList();
  }
});

const init = () => {
  renderWizard(wizardContainer, updateWizardControls);
  bindNavigation();
  bindExecutionRatings();
  toggleSections(getState().section);
  updateWizardControls();
  updateWizardProgress();
  updateProgramHeader();
  renderWeekTabs();
  workoutController.renderDayList();
};

init();
