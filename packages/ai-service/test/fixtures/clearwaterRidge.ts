import type { ObjectiveProposalsModelOutput, ProblemContextInput } from "../../src/types.ts";

// Synthetic scenario matching the web dashboard's demo event. Not real data.
export const clearwaterRidgeHousingProblem: ProblemContextInput = {
  disaster: {
    id: "dis-clearwater-ridge",
    name: "Clearwater Ridge Wildfire",
    hazardType: "Wildfire",
    location: "Interior British Columbia, Canada",
    declaredOn: "2026-08-14",
  },
  priority: {
    id: "pri-housing",
    name: "Restore safe housing",
    recoveryArea: "Housing",
  },
  problem: {
    id: "prb-017",
    code: "P-17",
    title: "Displaced residents lack interim housing",
    description:
      "An estimated 140 households were displaced. Local rental vacancy is near zero and hotel capacity is committed to fire crews through October.",
    severity: "high",
  },
  existingObjectives: [
    { id: "obj-003", title: "Complete damage assessments for all affected homes" },
  ],
};

export const validModelOutput: ObjectiveProposalsModelOutput = {
  objectives: [
    {
      title: "House all displaced households in interim accommodation within 60 days",
      description:
        "Every displaced household has a safe interim placement; tracked weekly as households placed / households displaced.",
      rationale:
        "The problem states 140 households are displaced with near-zero rental vacancy, so dedicated interim capacity is needed.",
      confidence: 0.8,
    },
    {
      title: "Establish a temporary housing site with capacity for 60 households",
      description:
        "A serviced temporary site is operational, measured by units available for occupancy.",
      rationale:
        "Hotel capacity is committed to fire crews, so additional capacity must be created. Site availability is not stated in the context.",
      confidence: 0.55,
    },
  ],
};
