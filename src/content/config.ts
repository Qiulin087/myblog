import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});

/* 学习理解：学习感悟与认知变化的长文 */
const learningCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		description: z.string().optional().default(""),
		draft: z.boolean().optional().default(false),
	}),
});

/* 生活记录：日期 + 一段短文字 + 可选照片（路径指向 public/ 下的静态资源） */
const lifeCollection = defineCollection({
	schema: z.object({
		published: z.date(),
		title: z.string().optional().default(""),
		photos: z.array(z.string()).optional().default([]),
		draft: z.boolean().optional().default(false),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	learning: learningCollection,
	life: lifeCollection,
};
