// SPDX-License-Identifier: MPL-2.0
import { generateToolSkill, type ToolSkillV1 } from '@lolly-tools/core/tool-skill-v1';
import type { LoadedTool } from '../../../../engine/src/loader.ts';

/** The loader retains the exact source reader and catalog integrity for this revision. */
export async function resolveToolSkill(tool: LoadedTool): Promise<ToolSkillV1> {
  return tool.readSkill ? tool.readSkill() : generateToolSkill(tool.manifest);
}
