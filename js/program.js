import { EXERCISES } from "./exercises.js";
import { setProgramWeeks, getState } from "./state.js";

const LEVEL_MAP = {
  beginner: "Новичок",
  intermediate: "Уверенный",
  advanced: "Опытный"
};

const GOAL_MAP = {
  loss: "Снижение веса",
  muscle: "Набор мышц",
  shape: "Поддержание формы"
};

const levelOrder = ["beginner", "intermediate", "advanced"];

const filterExercisesByLevel = (level) => {
  const targetIndex = levelOrder.indexOf(level);
  if (targetIndex === -1) {
    return EXERCISES;
  }

  return EXERCISES.filter((exercise) => {
    const exerciseIndex = levelOrder.indexOf(exercise.level);
    if (exerciseIndex === -1) {
      return true;
    }

    return exerciseIndex <= targetIndex;
  });
};

const TEMPLATES = {
  2: [
    { id: "upper", name: "Верх тела", muscles: ["chest", "back", "shoulders", "arms"], volume: 5 },
    { id: "lower", name: "Низ тела", muscles: ["legs", "glutes", "core"], volume: 5 }
  ],
  3: [
    { id: "push", name: "Жимовой", muscles: ["chest", "shoulders", "triceps"], volume: 5 },
    { id: "pull", name: "Тяговый", muscles: ["back", "biceps", "rear-delts"], volume: 5 },
    { id: "legs", name: "Ноги", muscles: ["legs", "glutes", "core"], volume: 5 }
  ],
  4: [
    { id: "upper-a", name: "Верх A", muscles: ["chest", "back", "shoulders"], volume: 5 },
    { id: "lower-a", name: "Низ A", muscles: ["legs", "glutes", "core"], volume: 5 },
    { id: "upper-b", name: "Верх B", muscles: ["chest", "shoulders", "arms"], volume: 5 },
    { id: "lower-b", name: "Низ B", muscles: ["legs", "glutes", "core"], volume: 5 }
  ],
  5: [
    { id: "chest", name: "Грудь", muscles: ["chest", "shoulders", "triceps"], volume: 4 },
    { id: "back", name: "Спина", muscles: ["back", "rear-delts", "biceps"], volume: 4 },
    { id: "shoulders", name: "Плечи", muscles: ["shoulders", "traps"], volume: 4 },
    { id: "legs", name: "Ноги", muscles: ["legs", "glutes", "core"], volume: 5 },
    { id: "arms", name: "Руки", muscles: ["biceps", "triceps", "forearms"], volume: 4 }
  ]
};

const MUSCLE_GROUP_ALIAS = {
  triceps: "arms",
  biceps: "arms",
  "rear-delts": "shoulders",
  traps: "shoulders",
  forearms: "arms",
  glutes: "legs"
};

const normalizeMuscle = (group) => MUSCLE_GROUP_ALIAS[group] || group;

const pickExercisesForTemplate = (template, pool) => {
  const selection = [];
  const seen = new Set();

  template.muscles.forEach((muscle) => {
    const normalized = normalizeMuscle(muscle);
    const matches = pool.filter((exercise) => normalizeMuscle(exercise.muscleGroup) === normalized);
    matches.forEach((exercise) => {
      if (selection.length < template.volume && !seen.has(exercise.id)) {
        selection.push(exercise);
        seen.add(exercise.id);
      }
    });
  });

  pool.forEach((exercise) => {
    if (selection.length < template.volume && !seen.has(exercise.id)) {
      selection.push(exercise);
      seen.add(exercise.id);
    }
  });

  return selection.slice(0, template.volume);
};

const adjustByGoal = (exercise, goal) => {
  const adjusted = { ...exercise };

  if (goal === "loss") {
    adjusted.reps = "15-20";
    adjusted.restSeconds = Math.max(15, (exercise.restSeconds || 60) - 15);
  }

  if (goal === "muscle") {
    adjusted.sets = (exercise.sets || 3) + 1;
    adjusted.restSeconds = (exercise.restSeconds || 60) + 15;
  }

  return adjusted;
};

const applyWeeklyProgression = (exercise, goal, weekIndex) => {
  const adjusted = { ...exercise };

  if (weekIndex === 1) {
    adjusted.reps = typeof adjusted.reps === "string" ? `${adjusted.reps}+1` : adjusted.reps;
  }

  if (weekIndex === 2 && goal === "muscle") {
    adjusted.sets = (adjusted.sets || exercise.sets || 3) + 1;
  }

  if (weekIndex === 3) {
    const nextRest = (adjusted.restSeconds || exercise.restSeconds || 60) - 5;
    adjusted.restSeconds = nextRest > 0 ? nextRest : adjusted.restSeconds;
  }

  return adjusted;
};

const createDayPlan = (template, pool, goal, weekIndex) => {
  const baseExercises = pickExercisesForTemplate(template, pool);
  return {
    id: template.id,
    title: template.name,
    exercises: baseExercises.map((exercise) => {
      const adapted = adjustByGoal({ ...exercise }, goal);
      const progressed = applyWeeklyProgression(adapted, goal, weekIndex);
      return {
        id: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: progressed.sets || exercise.sets,
        reps: progressed.reps || exercise.reps,
        restSeconds: progressed.restSeconds || exercise.restSeconds,
        technique: exercise.technique
      };
    })
  };
};

const buildWeek = (weekIndex, templates, pool, goal) => ({
  id: `week-${weekIndex + 1}`,
  title: `Неделя ${weekIndex + 1}`,
  days: templates.map((template) => createDayPlan(template, pool, goal, weekIndex))
});

export const buildProgram = (profile) => {
  const level = profile?.level || "beginner";
  const goal = profile?.goal || "shape";
  const days = Math.min(Math.max(profile?.days || 3, 2), 5);

  const templates = TEMPLATES[days] || TEMPLATES[3];
  const pool = filterExercisesByLevel(level === "advanced" ? "advanced" : level);

  const weeks = Array.from({ length: 4 }, (_, index) => buildWeek(index, templates, pool, goal));

  setProgramWeeks(weeks);
  return weeks;
};

export const getGoalLabel = (goal) => GOAL_MAP[goal] || "Цель";
export const getLevelLabel = (level) => LEVEL_MAP[level] || "Уровень";

export const regenerateProgram = () => {
  const { onboarding } = getState();
  return buildProgram(onboarding);
};
