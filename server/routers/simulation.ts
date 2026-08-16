import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { generateWaveResponses } from "../simulation";

const personaSchema = z.object({
  id: z.string().min(1).max(128), name: z.string().min(1).max(180), age: z.number().int().min(0).max(120), sex: z.string().max(64), city: z.string().max(128), state: z.string().max(32), zipCode: z.string().max(32), region: z.string().max(64), occupation: z.string().max(180), educationLevel: z.string().max(128), maritalStatus: z.string().max(128), bachelorsField: z.string().max(128), personaNarrative: z.string().max(5000), professionalBackground: z.string().max(5000), culturalBackground: z.string().max(5000), hobbiesAndInterests: z.string().max(5000), careerGoals: z.string().max(5000), skillsAndExpertise: z.string().max(5000), incomeTier: z.string().max(64), politicalLean: z.string().max(64), sourceDataset: z.string().max(180), sourceRecordId: z.string().max(128),
});

const questionSchema = z.string().trim().min(1, "A question is required.").max(600, "Questions must be 600 characters or fewer.");

export const simulationRouter = router({
  generate: publicProcedure.input(z.object({ question: questionSchema, personas: z.array(personaSchema).min(1).max(100) })).mutation(async ({ input }) => ({
    results: await generateWaveResponses(input.question, input.personas),
  })),
  generateWave: publicProcedure.input(z.object({ question: questionSchema, personas: z.array(personaSchema).min(1).max(100), waveIndex: z.number().int().min(0), totalWaves: z.number().int().min(1) })).mutation(async ({ input }) => ({
    results: await generateWaveResponses(input.question, input.personas), waveIndex: input.waveIndex, totalWaves: input.totalWaves, personaCount: input.personas.length,
  })),
});
