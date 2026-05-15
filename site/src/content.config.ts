/**
 * Astro Content Collections configuration.
 *
 * Defines the `courses` collection — every published course writeup lives
 * at `src/content/courses/<slug>.mdx` with a typed frontmatter contract.
 *
 * Tag validation against the controlled vocabulary (plan §7.15) and
 * date-format checks share a hand-rolled validator (`courseFrontmatter.ts`)
 * so the rules stay unit-testable without spinning up Astro.
 */
import { defineCollection, z } from "astro:content";
import { buildTagValidator } from "./content/concepts/validator";
import { buildFrontmatterValidator } from "./content/courseFrontmatter";
import tagsJson from "./content/concepts/_tags.json";

const tagValidator = buildTagValidator(tagsJson.tags);
const frontmatterValidator = buildFrontmatterValidator(tagValidator);

const courses = defineCollection({
  type: "content",
  schema: z
    .object({
      title: z.string(),
      term: z.string(),
      oneLineTakeaway: z.string(),
      concepts: z.array(z.string()).default([]),
      techTags: z.array(z.string()).default([]),
      heroDemoLabel: z.string().optional(),
      publishedAt: z.string().nullable().default(null),
      draft: z.boolean().default(false),
    })
    .superRefine((value, ctx) => {
      try {
        frontmatterValidator.validate(value);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: (e as Error).message,
        });
      }
    }),
});

export const collections = { courses };
