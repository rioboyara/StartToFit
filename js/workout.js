import {
  getState,
  setCurrentDay,
  updateExecution,
  startExecutionSession,
  addExecutionRating,
  markDayCompleted
} from "./state.js";
import { fetchTips, fetchMotivation } from "./api.js";

const formatSeconds = (value) => {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const createRestTimer = (duration, onTick, onComplete) => {
  let remaining = duration;
  let timerId = null;

  const tick = () => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timerId);
      onComplete();
      return;
    }
    onTick(Math.max(0, remaining));
  };

  timerId = setInterval(tick, 1000);
  onTick(Math.max(0, remaining));
  return () => clearInterval(timerId);
};

const getCompletionKey = (weekIndex, dayIndex) => `${weekIndex}-${dayIndex}`;

export const createWorkoutController = ({ state, elements, navigateTo }) => {
  const executionState = {
    timerCleanup: null,
    currentExerciseIndex: 0,
    tipsLoadedDay: null
  };

  const clearTimer = () => {
    if (executionState.timerCleanup) {
      executionState.timerCleanup();
      executionState.timerCleanup = null;
    }
  };

  const getCurrentWeek = () => {
    const data = getState();
    return data.program?.[data.currentWeek] || null;
  };

  const getCurrentDay = () => {
    const data = getState();
    return data.program?.[data.currentWeek]?.days?.[data.currentDay] || null;
  };

  const getDayStatus = (weekIndex, dayIndex) => {
    const { completedDays } = getState();
    const key = getCompletionKey(weekIndex, dayIndex);
    if (completedDays[key]) return { icon: "✓", label: "Готово", className: "completed" };
    if (weekIndex === getState().currentWeek && dayIndex === getState().currentDay)
      return { icon: "›", label: "В работе", className: "" };
    return { icon: "›", label: "Запланировано", className: "upcoming" };
  };

  const renderDayList = () => {
    const week = getCurrentWeek();
    if (!week || !elements.daysGrid) return;

    const { currentWeek } = getState();
    elements.daysGrid.innerHTML = week.days
      .map((day, index) => {
        const status = getDayStatus(currentWeek, index);
        return `
          <article class="day-card" data-day="${index}" tabindex="0">
            <header>
              <span class="muted">День ${index + 1}</span>
              <div class="status-group">
                <span class="status-icon">${status.icon}</span>
                <span class="status ${status.className}">${status.label}</span>
              </div>
            </header>
            <h3>${day.title || day.name}</h3>
            <p>${day.exercises.length} упражнений</p>
          </article>
        `;
      })
      .join("");

    elements.daysGrid.querySelectorAll(".day-card").forEach((card) => {
      card.addEventListener("click", () => openWorkout(Number(card.dataset.day)));
      card.addEventListener("keypress", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openWorkout(Number(card.dataset.day));
        }
      });
    });
  };

  const renderWorkoutDetail = async () => {
    const day = getCurrentDay();
    if (!day || !elements.workoutTitle || !elements.exerciseList) return;

    const data = getState();
    const weekNumber = data.currentWeek + 1;
    elements.workoutTitle.textContent = `Неделя ${weekNumber} · ${day.title}`;
    if (elements.workoutSubtitle) {
      elements.workoutSubtitle.textContent = day.exercises.map((exercise) => exercise.muscleGroup).join(" • ");
    }

    elements.exerciseList.innerHTML = day.exercises
      .map(
        (exercise) => `
          <div class="exercise-item">
            <div>
              <span class="pill pill-muted">${exercise.muscleGroup}</span>
              <h4>${exercise.name}</h4>
              <p>${exercise.sets} × ${exercise.reps}</p>
            </div>
            <span class="chevron">›</span>
          </div>
        `
      )
      .join("");

    if (elements.tipsCard && executionState.tipsLoadedDay !== `${data.currentWeek}-${data.currentDay}`) {
      const tips = await fetchTips(state.onboarding, day.exercises);
      const tipsText = elements.tipsCard.querySelector("[data-role=\"tips-text\"]");
      if (tipsText) {
        tipsText.textContent = tips;
      }
      executionState.tipsLoadedDay = `${data.currentWeek}-${data.currentDay}`;
    }
  };

  const openWorkout = async (dayIndex) => {
    setCurrentDay(dayIndex);
    await renderWorkoutDetail();
    navigateTo("workout");
  };

  const updateExecutionDots = (length) => {
    if (!elements.executionDots) return;
    elements.executionDots.innerHTML = Array.from({ length })
      .map((_, index) => `<span class="dot ${index === executionState.currentExerciseIndex ? "active" : ""}"></span>`)
      .join("");
  };

  const updateExecutionView = () => {
    const data = getState();
    const day = getCurrentDay();
    const exercise = day?.exercises?.[executionState.currentExerciseIndex];
    const execution = data.execution;

    if (!exercise || !elements.executionCard) return;

    const header = elements.executionCard.querySelector("header .muted");
    const musclePill = elements.executionCard.querySelector("header .pill");
    const title = elements.executionCard.querySelector("h3");
    const volume = elements.executionCard.querySelector("p.muted");
    const techniqueSummary = elements.executionCard.querySelector("details");
    const techniqueText = elements.executionCard.querySelector("details p");
    const restDisplay = elements.executionCard.querySelector(".rest-timer strong");

    if (header) header.textContent = `Подход ${execution.currentSet}/${exercise.sets}`;
    if (musclePill) musclePill.textContent = exercise.muscleGroup;
    if (title) title.textContent = exercise.name;
    if (volume) volume.textContent = `${exercise.sets} × ${exercise.reps}`;
    if (techniqueSummary) techniqueSummary.open = true;
    if (techniqueText) techniqueText.textContent = exercise.technique;

    updateExecutionDots(day.exercises.length);

    clearTimer();
    const restDuration = exercise.restSeconds || 60;
    executionState.timerCleanup = createRestTimer(
      restDuration,
      (remaining) => {
        if (restDisplay) {
          restDisplay.textContent = formatSeconds(remaining);
        }
      },
      () => {
        if (restDisplay) {
          restDisplay.textContent = "00:00";
        }
      }
    );
  };

  const startWorkoutExecution = () => {
    const day = getCurrentDay();
    if (!day) return;

    clearTimer();
    executionState.currentExerciseIndex = 0;
    startExecutionSession({ exerciseIndex: 0, currentSet: 1 });
    updateExecution({ currentSet: 1, exerciseIndex: 0, startTime: new Date().toISOString(), ratings: [] });
    updateExecutionDots(day.exercises.length);
    updateExecutionView();
    navigateTo("execution");
  };

  const advanceExercise = () => {
    executionState.currentExerciseIndex += 1;
    const day = getCurrentDay();

    if (!day || executionState.currentExerciseIndex >= day.exercises.length) {
      completeWorkout();
      return;
    }

    updateExecution({ currentSet: 1, exerciseIndex: executionState.currentExerciseIndex });
    updateExecutionView();
  };

  const handleExerciseRating = (rating) => {
    const day = getCurrentDay();
    if (!day) return;

    const exercise = day.exercises[executionState.currentExerciseIndex];
    const { execution } = getState();

    addExecutionRating(Number(rating));

    if (execution.currentSet < exercise.sets) {
      updateExecution({ currentSet: execution.currentSet + 1 });
      updateExecutionView();
      return;
    }

    advanceExercise();
  };

  const completeWorkout = async () => {
    const data = getState();
    const day = getCurrentDay();
    if (!day) return;

    clearTimer();

    const startTime = data.execution.startTime ? new Date(data.execution.startTime).getTime() : Date.now();
    const durationMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const exerciseCount = day.exercises.length;
    const averageDifficulty = data.execution.ratings.length
      ? data.execution.ratings.reduce((acc, value) => acc + value, 0) / data.execution.ratings.length
      : 0;

    if (elements.completionStats) {
      const exercisesEl = elements.completionStats.querySelector("[data-field=exercises]");
      const timeEl = elements.completionStats.querySelector("[data-field=time]");
      const feelingEl = elements.completionStats.querySelector("[data-field=feeling]");
      if (exercisesEl) exercisesEl.textContent = exerciseCount;
      if (timeEl) timeEl.textContent = `${durationMinutes} мин`;
      if (feelingEl) {
        feelingEl.textContent = averageDifficulty >= 1.5 ? "Тяжело" : averageDifficulty >= 0.5 ? "Норм" : "Легко";
      }
    }

    if (elements.completionSummary) {
      elements.completionSummary.textContent = `Ты закрыл ${exerciseCount} упражнений за ${durationMinutes} минут`;
    }

    const motivation = await fetchMotivation(state.onboarding);
    if (elements.completionMessage) {
      elements.completionMessage.textContent = motivation;
    }

    markDayCompleted(data.currentWeek, data.currentDay, {
      durationMinutes,
      difficulty: averageDifficulty
    });

    renderDayList();
    navigateTo("completion");
  };

  return {
    renderDayList,
    openWorkout,
    startWorkoutExecution,
    updateExecutionView,
    handleExerciseRating
  };
};
