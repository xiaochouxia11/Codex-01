import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanTestCaseString(testCaseStr: string): string {
  return testCaseStr.replace(/\\n/g, "").trim();
}

export function convertTestCaseToSteps(cleanedTestCase: string): string {
  const parsed = JSON.parse(cleanedTestCase);

  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error("Invalid test case format: missing steps array");
  }

  // Map each remaining step in the steps array into a formatted string
  return parsed.steps
    .map(
      (step: {
        step_number: number;
        step_instructions: string;
        status: string;
      }) => {
        return `Step ${step.step_number}: ${step.step_instructions}`;
      }
    )
    .join("\n");
}
