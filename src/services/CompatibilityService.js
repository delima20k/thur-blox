const includes = (list, value) => Array.isArray(list) && list.includes(value);

export const CompatibilityService = {
  getCompatibilityResult(brainrot, mutation) {
    const issues = [];
    const warnings = [];
    const slug = brainrot?.slug;
    const rarity = brainrot?.rarity;
    const entries = [mutation].filter(Boolean);

    for (const entry of entries) {
      const compatibility = entry.compatibility || {};
      if (includes(compatibility.incompatibleBrainrotSlugs, slug)) {
        issues.push(`${entry.name} nao e compativel com ${brainrot.name}.`);
      }
      if (includes(compatibility.incompatibleRarities, rarity)) {
        issues.push(`${entry.name} nao e compativel com a raridade ${rarity}.`);
      }
      if (
        compatibility.compatibleBrainrotSlugs?.length
        && !includes(compatibility.compatibleBrainrotSlugs, slug)
      ) {
        issues.push(`${entry.name} nao tem compatibilidade confirmada com este pet.`);
      }
      if (
        compatibility.compatibleRarities?.length
        && !includes(compatibility.compatibleRarities, rarity)
      ) {
        issues.push(`${entry.name} nao tem compatibilidade confirmada com esta raridade.`);
      }
      if (!Object.keys(compatibility).length) {
        warnings.push(`Compatibilidade de ${entry.name} nao confirmada.`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }
};
