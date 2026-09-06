---
title: 开始
published: 2026-09-03
description: 第一篇博客，顺便演示这个主题支持的 Markdown 写法。
# image: ./cover.jpg   # 封面图：把图片放在本目录下，取消这行注释即可
tags: [博客, 起步]
category: 随笔
draft: false
---

这是本博客的第一篇文章。它同时充当内容模板，演示这套主题支持的写法。确认没问题后，直接改掉正文即可。

## 写在前面

文章写在 `src/content/posts/` 下，两种组织方式：

- `文章名.md` —— 单文件，适合没有配图的短文
- `文章名/index.md` —— 目录形式，封面图和正文放一起，适合有配图的长文

用 `pnpm new-post 文章名` 也能快速新建，会自动填好 frontmatter 骨架。

## 基础排版

普通的 Markdown 都支持：

| 写法 | 效果 |
| --- | --- |
| `**加粗**` | **加粗** |
| `*斜体*` | *斜体* |
| `~~删除线~~` | ~~删除线~~ |
| `[链接](https://astro.build)` | [链接](https://astro.build) |

> 引用块长这样。

列表：

1. 有序列表
2. 第二项
   - 嵌套的无序列表

## 代码块

带文件名和行号：

```js title="hello.js" {2}
const greeting = "你好，世界";
console.log(greeting);
```

## 提示块

五种提示块都可用：

:::note
需要注意的信息。
:::

:::tip[自定义标题]
标题可以自定义，写成 `:::tip[标题]` 即可。
:::

:::important
重要的信息。
:::

:::warning
警告信息。
:::

:::caution
有负面后果的操作。
:::

也支持 GitHub 风格写法：

> [!TIP]
> 这种写法同样会被渲染成提示块。

## 行内剧透

这段文字里藏着一个 :spoiler[剧透内容]，鼠标悬停才显示。

## Frontmatter 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `published` | 是 | 发布日期 |
| `updated` | 否 | 更新日期 |
| `description` | 否 | 摘要，不填则自动截取正文开头 |
| `image` | 否 | 封面图，相对本文所在目录 |
| `tags` | 否 | 标签数组，可以有多个 |
| `category` | 否 | 分类，只能有一个 |
| `draft` | 否 | `true` 则生产环境不发布 |
| `lang` | 否 | 仅当文章语言与站点语言不同时填写 |
