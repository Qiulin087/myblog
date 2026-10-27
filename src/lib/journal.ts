/* 内容层数据获取：随笔（posts）、学习理解（learning）、生活记录（life）
   与 UI 组件分离，全部在构建时求值，不引入任何运行时依赖。 */
import { type CollectionEntry, getCollection } from "astro:content";
import { getSortedPosts } from "@utils/content-utils";
import { url } from "@utils/url-utils";

export type LearningEntry = CollectionEntry<"learning">;
export type LifeEntry = CollectionEntry<"life">;

function isDraft(data: { draft?: boolean }): boolean {
	return import.meta.env.PROD ? data.draft === true : false;
}

function byPublishedDesc(
	a: { data: { published: Date } },
	b: { data: { published: Date } },
): number {
	return b.data.published.getTime() - a.data.published.getTime();
}

/** 已发布的学习理解（时间倒序） */
export async function getLearningEntries(): Promise<LearningEntry[]> {
	const all = await getCollection("learning", ({ data }) => !isDraft(data));
	return all.sort(byPublishedDesc);
}

/** 已发布的生活记录（时间倒序，附带正文原文） */
export async function getLifeEntries(): Promise<
	{ slug: string; data: LifeEntry["data"]; body: string }[]
> {
	const all = await getCollection("life", ({ data }) => !isDraft(data));
	return all.sort(byPublishedDesc).map((e) => ({
		slug: e.slug,
		data: e.data,
		body: (e.body ?? "").trim(),
	}));
}

export type JournalItem =
	| {
			type: "post";
			date: Date;
			title: string;
			description: string;
			url: string;
	  }
	| {
			type: "learning";
			date: Date;
			title: string;
			description: string;
			url: string;
	  }
	| {
			type: "life";
			date: Date;
			text: string;
			photos: string[];
	  };

/** 聚合三类内容，按发布时间倒序 */
export async function getJournalItems(): Promise<JournalItem[]> {
	const posts = await getSortedPosts();
	const learning = await getLearningEntries();
	const life = await getLifeEntries();

	const items: JournalItem[] = [
		...posts.map((p) => ({
			type: "post" as const,
			date: p.data.published,
			title: p.data.title,
			description: p.data.description,
			url: url(`/posts/${p.slug}/`),
		})),
		...learning.map((e) => ({
			type: "learning" as const,
			date: e.data.published,
			title: e.data.title,
			description: e.data.description,
			url: url(`/learning/${e.slug}/`),
		})),
		...life.map((e) => ({
			type: "life" as const,
			date: e.data.published,
			text: e.body,
			photos: e.data.photos,
		})),
	];

	return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}
