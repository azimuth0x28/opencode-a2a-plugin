/**
 * Skill Mapper
 *
 * Converts discovered skills to A2A AgentSkill format
 */

import type { AgentSkill } from "@a2a-js/sdk";
import type { DiscoveredSkill, DiscoveryResult } from "./discovery.js";

/**
 * Map a single DiscoveredSkill to A2A AgentSkill format
 */
export function mapToAgentSkill(discovered: DiscoveredSkill): AgentSkill {
	return {
		id: discovered.id,
		name: discovered.name,
		description: discovered.description,
		inputModes: ["text"],
		outputModes: ["text"],
		tags: discovered.tags || [],
	};
}

/**
 * Map multiple DiscoveredSkills to A2A AgentSkill array
 */
export function mapToAgentSkills(discovered: DiscoveredSkill[]): AgentSkill[] {
	return discovered.map(mapToAgentSkill);
}

/**
 * Map DiscoveryResult to A2A AgentSkill array
 * Combines all skill sources into a single array
 */
export function mapDiscoveryResultToAgentSkills(
	result: DiscoveryResult,
): AgentSkill[] {
	// Use the deduplicated 'all' array from discovery result
	return mapToAgentSkills(result.all);
}

/**
 * Create AgentSkill array from commands only
 */
export function mapCommandsToAgentSkills(
	discovered: DiscoveredSkill[],
): AgentSkill[] {
	return mapToAgentSkills(discovered);
}

/**
 * Create AgentSkill array from tools only
 */
export function mapToolsToAgentSkills(discovered: DiscoveredSkill[]): AgentSkill[] {
	return mapToAgentSkills(discovered);
}

/**
 * Create AgentSkill array from plugin skills only
 */
export function mapPluginSkillsToAgentSkills(
	discovered: DiscoveredSkill[],
): AgentSkill[] {
	return mapToAgentSkills(discovered);
}

/**
 * Validate that an AgentSkill has required fields
 */
export function isValidAgentSkill(skill: unknown): skill is AgentSkill {
	if (!skill || typeof skill !== "object") return false;

	const s = skill as Record<string, unknown>;

	return (
		typeof s.id === "string" &&
		typeof s.name === "string" &&
		typeof s.description === "string"
	);
}

/**
 * Filter and validate an array of AgentSkills
 */
export function filterValidAgentSkills(skills: unknown[]): AgentSkill[] {
	return skills.filter(isValidAgentSkill);
}

/**
 * Create a skill with extended input/output modes
 * Useful for skills that support structured input
 */
export function createStructuredSkill(
	discovered: DiscoveredSkill,
	_supportsJson?: boolean,
): AgentSkill {
	const skill = mapToAgentSkill(discovered);

	// Note: AgentSkill doesn't support metadata, so we just update modes
	if (_supportsJson) {
		skill.inputModes = ["text", "json"];
		skill.outputModes = ["text", "json"];
	}

	return skill;
}