/** App-selected task instructions compiled from the package's distributable SKILL.md files. */
import { taskSkillDocuments } from './catalog.generated.js';

/** Stable id of a bundled text method. */
export type TaskSkillId = keyof typeof taskSkillDocuments;

/** Description for discovery and Markdown body for the selected task. */
export interface TaskSkill {
  /** What the task delivers and when to select it. */
  readonly description: string;
  /** Instructions to add to the App's matching model stage. */
  readonly instructions: string;
}

/** Frozen methods. Selecting an entry adds no tools, handlers or permissions. */
export const taskSkills: Readonly<Record<TaskSkillId, TaskSkill>> =
  Object.freeze(taskSkillDocuments);
