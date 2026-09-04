const ROOT_ENVIRONMENT_FILE = ".env.local";

function escapeRegex(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

function matchesRootEnvironment(patternInput: string): boolean {
  let pattern = patternInput;
  if (pattern.startsWith("/")) pattern = pattern.slice(1);
  while (pattern.startsWith("**/")) pattern = pattern.slice(3);
  if (pattern.endsWith("/") || pattern.includes("/")) return false;

  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "\\" && index + 1 < pattern.length) {
      expression += escapeRegex(pattern[index + 1]);
      index += 1;
    } else if (character === "*") {
      while (pattern[index + 1] === "*") index += 1;
      expression += ".*";
    } else if (character === "?") {
      expression += ".";
    } else if (character === "[") {
      const closing = pattern.indexOf("]", index + 1);
      if (closing === -1) expression += "\\[";
      else {
        const contents = pattern.slice(index + 1, closing);
        const negated = contents.startsWith("!") ? `^${contents.slice(1)}` : contents;
        expression += `[${negated.replaceAll("\\", "\\\\")}]`;
        index = closing;
      }
    } else {
      expression += escapeRegex(character);
    }
  }
  try {
    return new RegExp(`${expression}$`).test(ROOT_ENVIRONMENT_FILE);
  } catch {
    return false;
  }
}

/** Resolve gitignore rules that can affect the root .env.local file, in order. */
export function effectivelyIgnoresLocalEnvironment(source: string): boolean {
  let ignored = false;
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    if (negated) line = line.slice(1);
    if (!matchesRootEnvironment(line)) continue;
    ignored = !negated;
  }
  return ignored;
}
