import { createInterface } from "node:readline/promises";
import type { SelectChoice } from "../types/prompt.js";

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function ask(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

export async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [y/N] `)).toLowerCase();
  return answer === "y" || answer === "yes";
}

export async function select<T>(
  label: string,
  choices: SelectChoice<T>[]
): Promise<T> {
  if (choices.length === 0) {
    throw new Error(`No ${label.toLowerCase()} available.`);
  }

  if (choices.length === 1) {
    const [only] = choices as [SelectChoice<T>];
    console.log(`${label}: ${only.title}`);
    return only.value;
  }

  if (!isInteractive()) {
    throw new Error(`Multiple ${label.toLowerCase()} options found. Pass it with a flag.`);
  }

  console.log(`${label}:`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}) ${choice.title}`);
  });

  for (;;) {
    const answer = await ask(`Select 1-${choices.length}: `);
    const choice = choices[Number.parseInt(answer, 10) - 1];

    if (choice && /^\d+$/.test(answer)) {
      return choice.value;
    }

    console.log("Invalid choice, try again.");
  }
}
