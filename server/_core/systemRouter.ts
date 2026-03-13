import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { hasLlmConfig } from "./llm";
import { hasStorageConfig } from "../storage";
import { hasLocalRecognitionSupport } from "../local-recognition";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  runtimeStatus: publicProcedure.query(async () => {
    const llmConfigured = hasLlmConfig();
    const storageConfigured = hasStorageConfig();
    const localRecognitionSupported = await hasLocalRecognitionSupport();
    const screenshotRecognitionEnabled =
      llmConfigured || localRecognitionSupported;
    const analysisMode = llmConfigured
      ? ("ai" as const)
      : localRecognitionSupported
        ? ("local" as const)
        : ("manual" as const);

    return {
      runtime: "local" as const,
      llmConfigured,
      storageConfigured,
      screenshotRecognitionEnabled,
      analysisMode,
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
