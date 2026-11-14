/* 博客编辑器（PWA）—— 通过 GitHub Contents API 直接管理 src/content/posts 下的文章。
   无后端：token 保存在浏览器本地，所有写操作都作为一次 git 提交，由 Vercel 自动部署。 */
(() => {
	var CONFIG = {
		owner: "Qiulin087",
		repo: "myblog",
		branch: "main",
		/* 三类内容各自的目录（与 src/content.config.ts 的三个集合对应） */
		dirs: {
			post: "src/content/posts/",
			learning: "src/content/learning/",
			life: "src/content/life/",
		},
		/* 网页版部署在博客同域名下，直接取当前地址（换平台/绑域名自动跟随）；
		   APK 内是 file://，取不到真实域名，回退到写死值（换域名时更新这里并重新构建 APK） */
		siteUrl:
			location.protocol.indexOf("http") === 0
				? location.origin + "/"
				: "https://myblog-qiulin1.vercel.app/",
	};

	var TYPE_LABELS = { post: "随笔", learning: "学习理解", life: "生活记录" };

	var API = "https://api.github.com";
	var LS_TOKEN = "be:token";

	/* ---------- 工具 ---------- */

	function $(id) {
		return document.getElementById(id);
	}

	function b64encode(str) {
		var bytes = new TextEncoder().encode(str);
		var bin = "";
		var CH = 0x8000;
		for (var i = 0; i < bytes.length; i += CH) {
			bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
		}
		return btoa(bin);
	}

	function b64decode(b64) {
		var bin = atob(b64.replace(/\s/g, ""));
		var bytes = new Uint8Array(bin.length);
		for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
		return new TextDecoder().decode(bytes);
	}

	function bytesToB64(bytes) {
		var bin = "";
		var CH = 0x8000;
		for (var i = 0; i < bytes.length; i += CH) {
			bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
		}
		return btoa(bin);
	}

	function encPath(p) {
		return p.split("/").map(encodeURIComponent).join("/");
	}

	function today() {
		var d = new Date();
		return (
			d.getFullYear() +
			"-" +
			String(d.getMonth() + 1).padStart(2, "0") +
			"-" +
			String(d.getDate()).padStart(2, "0")
		);
	}

	function unq(v) {
		v = String(v == null ? "" : v).trim();
		if (
			v.length >= 2 &&
			((v[0] === '"' && v[v.length - 1] === '"') ||
				(v[0] === "'" && v[v.length - 1] === "'"))
		) {
			return v.slice(1, -1);
		}
		return v;
	}

	function parseTags(v) {
		v = unq(v);
		if (!v) return [];
		var inner = v.replace(/^\[/, "").replace(/\]$/, "");
		return inner
			.split(",")
			.map((s) => unq(s))
			.filter(Boolean);
	}

	/* 生成 YAML 字符串标量：
	   空串以及会被 YAML 解析成 null/布尔/数字（含 2026 这类纯数字）的值必须加引号，
	   否则内容集合的 z.string() 校验会失败；含英文冒号等不安全字符的值也一律加引号。 */
	function qv(v) {
		v = String(v == null ? "" : v);
		if (
			v === "" ||
			/^(null|~|true|false|yes|no|on|off|[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?|[-+]?\.(inf|Inf|INF)|\.(nan|NaN|NAN))$/i.test(
				v,
			)
		) {
			return JSON.stringify(v);
		}
		if (
			/^[\w\u4e00-\u9fa5 .,()（）·、！？!?：+-]*$/.test(v) &&
			!/^\s/.test(v) &&
			!/\s$/.test(v) &&
			!/^-\s/.test(v)
		) {
			return v;
		}
		return JSON.stringify(v);
	}

	function mapLimit(items, limit, fn) {
		var ret = new Array(items.length);
		var idx = 0;
		function worker() {
			if (idx >= items.length) return Promise.resolve();
			var my = idx++;
			return Promise.resolve()
				.then(() => fn(items[my], my))
				.then((r) => {
					ret[my] = r;
				})
				.then(worker);
		}
		var workers = [];
		for (var i = 0; i < Math.min(limit, items.length); i++)
			workers.push(worker());
		return Promise.all(workers).then(() => ret);
	}

	function icons() {
		if (window.lucide) window.lucide.createIcons();
	}

	/* ---------- GitHub API ---------- */

	function gh(path, opts) {
		opts = opts || {};
		var headers = { Accept: "application/vnd.github+json" };
		if (state.token) headers.Authorization = "Bearer " + state.token;
		if (opts.headers)
			Object.keys(opts.headers).forEach((k) => {
				headers[k] = opts.headers[k];
			});
		return fetch(API + path, {
			method: opts.method || "GET",
			headers: headers,
			body: opts.body,
		}).then((res) => {
			if (res.status === 401)
				throw { kind: "auth", message: "token 无效或已过期，请重新设置" };
			if (res.status === 409)
				throw {
					kind: "conflict",
					message: "文章已在别处被修改，请刷新列表后重试",
				};
			if (!res.ok) {
				return res
					.json()
					.catch(() => ({}))
					.then((j) => {
						throw {
							kind: "api",
							status: res.status,
							message:
								j && j.message ? j.message : "GitHub API 错误 " + res.status,
						};
					});
			}
			return res.json();
		});
	}

	/* ---------- frontmatter ---------- */

	function parseFrontmatter(raw) {
		var m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(raw);
		if (!m) return { attrs: {}, lists: {}, order: [], body: raw };
		var attrs = {},
			lists = {},
			order = [],
			lastKey = null;
		m[1].split(/\r?\n/).forEach((line) => {
			var t = line.trim();
			if (!t || t.charAt(0) === "#") return;
			var item = /^-\s+(.*)$/.exec(t);
			if (item && lastKey) {
				if (!lists[lastKey]) lists[lastKey] = [];
				lists[lastKey].push(unq(item[1]));
				return;
			}
			var mm = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(t);
			if (!mm) return;
			attrs[mm[1]] = mm[2];
			order.push(mm[1]);
			lastKey = mm[1];
		});
		return {
			attrs: attrs,
			lists: lists,
			order: order,
			body: raw.slice(m[0].length),
		};
	}

	/* 各类型 frontmatter 中由表单托管的键；其余键（如 lang）原样保留 */
	var MANAGED = {
		post: ["title", "published", "description", "tags", "category", "draft"],
		learning: ["title", "published", "description", "draft"],
		life: ["published", "title", "photos", "draft"],
	};

	function buildFile(p) {
		var lines = [];
		if (p.type === "life") {
			lines.push("published: " + (p.date || today()));
			if (p.title) lines.push("title: " + qv(p.title));
			if (p.photos && p.photos.length) {
				lines.push("photos:");
				p.photos.forEach((src) => lines.push("  - " + qv(src)));
			}
		} else {
			lines.push("title: " + qv(p.title));
			lines.push("published: " + (p.date || today()));
			lines.push("description: " + qv(p.description));
		}
		(p.order || []).forEach((k) => {
			if (MANAGED[p.type].indexOf(k) >= 0) return;
			if (p.lists && Object.prototype.hasOwnProperty.call(p.lists, k)) {
				lines.push(k + ":");
				p.lists[k].forEach((v) => lines.push("  - " + qv(v)));
			} else {
				lines.push(k + ": " + p.attrs[k]);
			}
		});
		if (p.type === "post") {
			lines.push("tags: [" + p.tags.map(qv).join(", ") + "]");
			lines.push("category: " + qv(p.category));
		}
		lines.push("draft: " + (p.draft ? "true" : "false"));
		return "---\n" + lines.join("\n") + "\n---\n" + p.body;
	}

	/* ---------- 状态 ---------- */

	var state = {
		token: localStorage.getItem(LS_TOKEN) || "",
		demo: new URLSearchParams(location.search).has("demo"),
		posts: [],
		filter: "all",
		current: null,
		serverBody: "",
		dirty: false,
		saving: false,
	};

	function draftKey(path) {
		return "be:draft:" + path;
	}

	/* ---------- 屏幕切换 / 提示 ---------- */

	function showScreen(name) {
		$("screen-auth").hidden = name !== "auth";
		$("screen-list").hidden = name !== "list";
		$("screen-edit").hidden = name !== "edit";
	}

	var toastTimer = null;
	function toast(msg) {
		$("toast-text").textContent = msg;
		var t = $("toast");
		t.hidden = false;
		t.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			t.classList.remove("show");
		}, 2400);
	}

	function setHint(mode) {
		var h = $("save-hint");
		h.classList.remove("ok", "busy");
		if (mode === "saved") {
			h.classList.add("ok");
			h.innerHTML = '<i data-lucide="circle-check"></i>已保存';
		} else if (mode === "busy") {
			h.classList.add("busy");
			h.innerHTML = '<i data-lucide="refresh-cw"></i>提交中…';
		} else {
			h.innerHTML = '<i data-lucide="pencil-line"></i>未保存';
		}
		icons();
	}

	function showErr(el, msg) {
		el.textContent = msg;
		el.hidden = false;
	}
	function hideErr(el) {
		el.hidden = true;
	}

	/* ---------- 授权 ---------- */

	$("auth-domain").textContent = CONFIG.owner + "/" + CONFIG.repo;

	$("btn-auth-save").addEventListener("click", () => {
		var tk = $("f-token").value.trim();
		hideErr($("auth-error"));
		if (!tk) {
			showErr($("auth-error"), "请先粘贴 token");
			return;
		}
		var btn = $("btn-auth-save");
		btn.disabled = true;
		state.token = tk;
		gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo)
			.then(() => {
				state.token = tk;
				localStorage.setItem(LS_TOKEN, tk);
				toast("token 有效，已保存");
				loadList();
			})
			.catch((e) => {
				state.token = localStorage.getItem(LS_TOKEN) || "";
				showErr($("auth-error"), e.message || "验证失败，请检查 token 和网络");
			})
			.finally(() => {
				btn.disabled = false;
			});
	});

	$("btn-settings").addEventListener("click", () => {
		$("f-token").value = state.token || "";
		showScreen("auth");
	});

	/* ---------- 列表 ---------- */

	$("btn-visit").href = CONFIG.siteUrl;

	function listState(html) {
		$("post-list").innerHTML = '<div class="list-state">' + html + "</div>";
		icons();
	}

	function loadList() {
		showScreen("list");
		listState('<div class="spinner"></div><span>正在加载文章…</span>');
		var prep;
		if (state.demo) {
			prep = Promise.resolve().then(demoTree);
		} else {
			prep = gh(
					"/repos/" +
						CONFIG.owner +
						"/" +
						CONFIG.repo +
						"/git/trees/" +
						CONFIG.branch +
						"?recursive=1",
				).then((tree) => {
					var entries = collectEntries(tree);
				return mapLimit(entries, 6, (post) =>
					gh(
						"/repos/" +
							CONFIG.owner +
							"/" +
							CONFIG.repo +
							"/contents/" +
							encPath(post.path),
					).then((j) => {
						post.sha = j.sha;
						applyRaw(post, b64decode(j.content || ""));
					}),
				).then(() => entries);
			});
		}
		prep
			.then((entries) => {
				if (!state.demo) state.posts = entries;
				state.posts.sort(
					(a, b) =>
						(b.date || "").localeCompare(a.date || "") ||
						a.slug.localeCompare(b.slug),
				);
				renderList();
			})
			.catch((e) => {
				listState(
					'<i data-lucide="cloud-off"></i><span>' +
						esc(e.message || "加载失败") +
						"</span>",
				);
				var retry = document.createElement("button");
				retry.className = "pill-btn";
				retry.type = "button";
				retry.textContent = "重试";
				retry.addEventListener("click", loadList);
				$("post-list").querySelector(".list-state").appendChild(retry);
				if (e.kind === "auth") {
					$("f-token").value = state.token || "";
					showScreen("auth");
					showErr($("auth-error"), e.message);
				}
			});
		icons();
	}

	/* Fuwari 主题自带的模板文章（日期均早于第一篇正式文章《开始》2026-09-03），
	   编辑器列表不再显示；文件仍保留在仓库中 */
	var HIDDEN_SLUGS = new Set([
		"draft",
		"expressive-code",
		"guide",
		"markdown",
		"markdown-extended",
		"video",
	]);

	function collectEntries(tree) {
		var found = new Map();
		Object.keys(CONFIG.dirs).forEach((type) => {
			var dir = CONFIG.dirs[type];
			(tree.tree || []).forEach((item) => {
				if (item.type !== "blob") return;
				if (item.path.indexOf(dir) !== 0) return;
				var rel = item.path.slice(dir.length);
				var m = /^(.*)\/index\.md$/.exec(rel);
				var slug = m ? m[1] : /\.md$/.test(rel) ? rel.slice(0, -3) : null;
				if (!slug || HIDDEN_SLUGS.has(slug)) return;
				var key = type + "/" + slug;
				if (!found.has(key))
					found.set(key, {
						slug: slug,
						path: item.path,
						isDir: !!m,
						type: type,
					});
			});
		});
		var arr = [];
		found.forEach((v) => {
			v.title = v.slug;
			v.date = "";
			v.draft = false;
			v.description = "";
			v.tags = [];
			v.category = "";
			v.photos = [];
			v.attrs = {};
			v.lists = {};
			v.order = [];
			v.body = "";
			arr.push(v);
		});
		return arr;
	}

	function applyRaw(post, raw) {
		var fm = parseFrontmatter(raw);
		post.raw = raw;
		post.attrs = fm.attrs;
		post.lists = fm.lists;
		post.order = fm.order;
		post.body = fm.body;
		post.date = unq(fm.attrs.published).slice(0, 10);
		post.draft = unq(fm.attrs.draft) === "true";
		if (post.type === "life") {
			post.title = unq(fm.attrs.title);
			post.description = "";
			post.tags = [];
			post.category = "";
			post.photos = fm.lists.photos || [];
		} else {
			post.title = unq(fm.attrs.title) || post.slug;
			post.description = unq(fm.attrs.description);
			post.tags = parseTags(fm.attrs.tags);
			post.category = unq(fm.attrs.category);
			post.photos = [];
		}
	}

	function updateCounts() {
		var n = { all: state.posts.length, post: 0, learning: 0, life: 0 };
		state.posts.forEach((p) => {
			if (n[p.type] !== undefined) n[p.type]++;
		});
		$("count-all").textContent = n.all;
		$("count-post").textContent = n.post;
		$("count-learning").textContent = n.learning;
		$("count-life").textContent = n.life;
	}

	function setFilter(f) {
		state.filter = f;
		Array.prototype.forEach.call(
			document.querySelectorAll(".f-pill"),
			(b) => {
				b.classList.toggle("active", b.getAttribute("data-filter") === f);
			},
		);
		renderList();
	}

	Array.prototype.forEach.call(
		document.querySelectorAll(".f-pill"),
		(b) => {
			b.addEventListener("click", () =>
				setFilter(b.getAttribute("data-filter")),
			);
		},
	);

	function renderList() {
		updateCounts();
		var box = $("post-list");
		var posts = state.posts.filter(
			(p) => state.filter === "all" || p.type === state.filter,
		);
		if (!posts.length) {
			listState(
				'<i data-lucide="feather"></i><span>' +
					(state.filter === "all"
						? "还没有内容，点下方按钮开始写第一篇"
						: "这个分类还没有内容") +
					"</span>",
			);
			return;
		}
		box.innerHTML = "";
		posts.forEach((p) => {
			var b = document.createElement("button");
			b.type = "button";
			b.className = "post";
			b.innerHTML =
				'<span class="dot ' +
				(p.draft ? "draft" : "pub") +
				'"></span>' +
				'<span class="p-main"><span class="p-title">' +
				esc(p.title || p.slug) +
				"</span>" +
				'<span class="p-meta">' +
				esc(TYPE_LABELS[p.type] || "") +
				" · " +
				esc(p.date || "未填日期") +
				" · <em" +
				(p.draft ? ' class="draft"' : "") +
				">" +
				(p.draft ? "草稿" : "已发布") +
				"</em></span></span>" +
				'<i data-lucide="chevron-right"></i>';
			b.addEventListener("click", () => {
				openPost(p);
			});
			box.appendChild(b);
		});
		icons();
	}

	function esc(s) {
		return String(s == null ? "" : s).replace(
			/[&<>"']/g,
			(c) =>
				({
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				})[c],
		);
	}

	$("btn-refresh").addEventListener("click", () => {
		if (!state.demo) loadList();
		else {
			renderList();
			toast("演示模式：数据为本地模拟");
		}
	});
	$("btn-new").addEventListener("click", openNewDialog);

	/* ---------- 编辑 ---------- */

	function fillForm(p) {
		$("f-title").value = p.title;
		$("f-cat").value = p.category;
		$("f-tags").value = p.tags.join(", ");
		$("f-desc").value = p.description;
		$("f-draft").checked = p.draft;
		$("f-date").value = p.date || today();
		$("f-body").value = p.body || "";
	}

	function readForm(p) {
		p.title = $("f-title").value.trim();
		if (p.type !== "life" && !p.title) p.title = p.slug;
		p.category = $("f-cat").value.trim();
		p.tags = $("f-tags")
			.value.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		p.description = $("f-desc").value.trim();
		p.draft = $("f-draft").checked;
		p.date = $("f-date").value || today();
		p.body = $("f-body").value;
	}

	function openPost(p) {
		state.current = p;
		state.serverBody = p.body || "";
		state.openSnapshot = {
			title: p.title,
			cat: p.category,
			tags: p.tags.slice(),
			desc: p.description,
			draft: p.draft,
			date: p.date,
			body: p.body,
			photos: (p.photos || []).slice(),
		};
		/* 按类型显隐表单区块 */
		$("edit-type-badge").textContent = TYPE_LABELS[p.type] || "内容";
		$("field-post-meta").hidden = p.type !== "post";
		$("field-desc-wrap").hidden = p.type === "life";
		$("lbl-title").textContent = p.type === "life" ? "标题（可选）" : "标题";
		$("section-life-photos").hidden = p.type !== "life";
		$("btn-img").querySelector("span").textContent =
			p.type === "life" ? "添加照片" : "插入配图";
		var strip = CONFIG.dirs[p.type] || "";
		$("edit-title").textContent = p.title || p.slug;
		$("edit-state").textContent = "正在编辑 · " + p.path.replace(strip, "");
		fillForm(p);
		hideErr($("auth-error"));
		$("draft-banner").hidden = true;
		state.dirty = false;
		setHint(p.sha ? "saved" : "dirty");
		var saved = localStorage.getItem(draftKey(p.path));
		if (saved) {
			try {
				var d = JSON.parse(saved);
				if (d.body !== state.serverBody || d.title !== p.title) {
					p.title = d.title;
					p.category = d.cat;
					p.tags = d.tags;
					p.description = d.desc;
					p.draft = d.draft;
					p.date = d.date;
					p.body = d.body;
					p.photos = d.photos || [];
					fillForm(p);
					state.dirty = true;
					setHint("dirty");
					$("draft-banner").hidden = false;
				}
			} catch (e) {
				/* 忽略损坏的本地草稿 */
			}
		}
		renderPhotoGrid();
		showScreen("edit");
		switchTab("write");
		icons();
	}

	function autosaveDraft() {
		var p = state.current;
		if (!p) return;
		readForm(p);
		try {
			localStorage.setItem(
				draftKey(p.path),
				JSON.stringify({
					title: p.title,
					cat: p.category,
					tags: p.tags,
					desc: p.description,
					draft: p.draft,
					date: p.date,
					body: p.body,
					photos: p.photos || [],
					at: Date.now(),
				}),
			);
		} catch (e) {
			/* 存储满等异常忽略 */
		}
	}

	var autosaveTimer = null;
	function markDirty() {
		state.dirty = true;
		setHint("dirty");
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(autosaveDraft, 600);
	}

	["f-title", "f-cat", "f-tags", "f-desc", "f-body"].forEach((id) => {
		$(id).addEventListener("input", markDirty);
	});
	$("f-draft").addEventListener("change", markDirty);
	$("f-date").addEventListener("change", markDirty);

	$("btn-discard-draft").addEventListener("click", () => {
		var p = state.current;
		if (!p) return;
		localStorage.removeItem(draftKey(p.path));
		var s = state.openSnapshot;
		p.title = s.title;
		p.category = s.cat;
		p.tags = s.tags;
		p.description = s.desc;
		p.draft = s.draft;
		p.date = s.date;
		p.body = s.body;
		p.photos = (s.photos || []).slice();
		fillForm(p);
		renderPhotoGrid();
		state.dirty = false;
		setHint("saved");
		$("draft-banner").hidden = true;
		toast("已还原为线上版本");
	});

	$("btn-back").addEventListener("click", () => {
		if (state.dirty) toast("本地草稿已暂存，记得回来保存");
		state.current = null;
		loadList();
	});

	/* ---------- 选项卡：编辑 / 预览 ---------- */

	function renderPreview() {
		var src = $("f-body").value;
		if (!window.marked) {
			$("preview").textContent = src;
			return;
		}
		var md = src.replace(
			/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
			(all, alt, srcp) => {
				if (/^https?:\/\//.test(srcp)) return all;
				var name = srcp.split("/").pop();
				return (
					'<div class="be-img-slot"><i data-lucide="image"></i><span>' +
					esc(alt || "图片") +
					" · " +
					esc(name) +
					"</span></div>"
				);
			},
		);
		$("preview").innerHTML = marked.parse(md);
		icons();
	}

	function switchTab(which) {
		var w = which === "prev";
		$("tab-write").classList.toggle("on", !w);
		$("tab-prev").classList.toggle("on", w);
		$("tab-write").setAttribute("aria-selected", String(!w));
		$("tab-prev").setAttribute("aria-selected", String(w));
		$("pane-write").hidden = w;
		$("pane-prev").hidden = !w;
		if (w) renderPreview();
	}

	$("tab-write").addEventListener("click", () => {
		switchTab("write");
	});
	$("tab-prev").addEventListener("click", () => {
		switchTab("prev");
	});

	/* ---------- Markdown 工具栏 ---------- */

	function insertWrap(pre, suf, placeholder) {
		var ta = $("f-body");
		var s = ta.selectionStart,
			e = ta.selectionEnd;
		var hasSel = e > s;
		var sel = ta.value.slice(s, e) || placeholder;
		var text = pre + sel + suf;
		ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
		if (hasSel) {
			ta.setSelectionRange(s + text.length, s + text.length);
		} else {
			ta.setSelectionRange(s + pre.length, s + pre.length + placeholder.length);
		}
		ta.focus();
		markDirty();
	}

	function insertLinePrefix(prefix) {
		var ta = $("f-body");
		var s = ta.selectionStart;
		var lineStart = ta.value.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
		ta.value =
			ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
		ta.setSelectionRange(s + prefix.length, s + prefix.length);
		ta.focus();
		markDirty();
	}

	var TOOL_ACTIONS = {
		bold: () => {
			insertWrap("**", "**", "加粗文字");
		},
		heading: () => {
			insertLinePrefix("## ");
		},
		quote: () => {
			insertLinePrefix("> ");
		},
		code: () => {
			insertWrap("`", "`", "代码");
		},
		list: () => {
			insertLinePrefix("- ");
		},
		link: () => {
			insertWrap("[", "](https://)", "链接文字");
		},
	};

	Array.prototype.forEach.call(
		document.querySelectorAll("#md-tools [data-tool]"),
		(btn) => {
			btn.addEventListener("click", () => {
				var fn = TOOL_ACTIONS[btn.getAttribute("data-tool")];
				if (fn) fn();
			});
		},
	);

	/* ---------- 保存 ---------- */

	$("btn-save").addEventListener("click", () => {
		if (state.saving || !state.current) return;
		var p = state.current;
		readForm(p);
		if (p.type !== "life" && !$("f-title").value.trim()) {
			toast("请先填写标题");
			$("f-title").focus();
			return;
		}
		if (state.demo) {
			state.dirty = false;
			setHint("saved");
			toast("演示模式：未真正提交");
			return;
		}
		state.saving = true;
		$("btn-save").disabled = true;
		setHint("busy");
		var isNew = !p.sha;
		var msg =
			(isNew ? p.type + ": 新增《" : p.type + ": 编辑《") +
			(p.title || p.slug) +
			"》（手机端）";
		var body = {
			message: msg,
			content: b64encode(buildFile(p)),
			branch: CONFIG.branch,
		};
		if (p.sha) body.sha = p.sha;
		gh(
			"/repos/" +
				CONFIG.owner +
				"/" +
				CONFIG.repo +
				"/contents/" +
				encPath(p.path),
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			},
		)
			.then((j) => {
				p.sha = j.content.sha;
				var raw = buildFile(p);
				applyRaw(p, raw);
				localStorage.removeItem(draftKey(p.path));
				state.dirty = false;
				setHint("saved");
				$("edit-state").textContent =
					"正在编辑 · " + p.path.replace(CONFIG.dirs[p.type] || "", "");
				if (!state.posts.some((x) => x.path === p.path)) state.posts.push(p);
				toast(
					isNew ? "已提交，约 1 分钟后线上生效" : "已保存，约 1 分钟后线上生效",
				);
			})
			.catch((e) => {
				setHint("dirty");
				if (e.kind === "auth") {
					$("f-token").value = state.token || "";
					showScreen("auth");
					showErr($("auth-error"), e.message);
				} else toast(e.message || "保存失败，请重试");
			})
			.finally(() => {
				state.saving = false;
				$("btn-save").disabled = false;
			});
	});

	/* ---------- 删除 ---------- */

	$("btn-del").addEventListener("click", () => {
		var p = state.current;
		if (!p || !p.sha) {
			toast("新建的还未保存，直接返回即可");
			return;
		}
		if (
			!confirm(
				"删除《" +
					(p.title || p.slug) +
					"》？\n会提交一次删除记录，可在 GitHub 上回滚。",
			)
		)
			return;
		if (state.demo) {
			toast("演示模式：未真正删除");
			return;
		}
		var btn = $("btn-del");
		btn.disabled = true;
		var job;
		if (p.isDir) {
			job = gh(
				"/repos/" +
					CONFIG.owner +
					"/" +
					CONFIG.repo +
					"/contents/" +
					encPath(p.path),
			).then((listing) =>
				mapLimit(listing, 3, (item) =>
					gh(
						"/repos/" +
							CONFIG.owner +
							"/" +
							CONFIG.repo +
							"/contents/" +
							encPath(item.path),
						{
							method: "DELETE",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								message: p.type + ": 删除 " + item.path + "（手机端）",
								sha: item.sha,
								branch: CONFIG.branch,
							}),
						},
					),
				),
			);
		} else {
			job = gh(
				"/repos/" +
					CONFIG.owner +
					"/" +
					CONFIG.repo +
					"/contents/" +
					encPath(p.path),
				{
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: p.type + ": 删除《" + (p.title || p.slug) + "》（手机端）",
						sha: p.sha,
						branch: CONFIG.branch,
					}),
				},
			);
		}
		job
			.then(() => {
				localStorage.removeItem(draftKey(p.path));
				state.posts = state.posts.filter((x) => x.path !== p.path);
				toast("已删除");
				state.current = null;
				loadList();
			})
			.catch((e) => {
				toast(e.message || "删除失败，请重试");
			})
			.finally(() => {
				btn.disabled = false;
			});
	});

	/* ---------- 图片 ---------- */

	$("btn-img").addEventListener("click", () => {
		$("img-input").click();
	});

	$("img-input").addEventListener("change", function () {
		var files = Array.prototype.slice.call(this.files || []);
		this.value = "";
		if (!files.length || !state.current) return;
		var p = state.current;
		var job;
		if (p.type === "life") {
			job = uploadLifePhotos(files);
		} else if (p.type === "post") {
			job = ensureDirPost().then(() => mapLimit(files, 2, (f) => uploadImage(f)));
		} else {
			/* 学习理解：图片直接传到 learning/ 目录，正文以相对路径引用 */
			job = mapLimit(files, 2, (f) => uploadImage(f));
		}
		job.catch((e) => {
			if (e.kind === "auth") {
				$("f-token").value = state.token || "";
				showScreen("auth");
				showErr($("auth-error"), e.message);
			} else toast(e.message || "图片上传失败");
		});
	});

	/* 单文件文章首次插图时转为目录形式（slug/index.md），图片才有归属 */
	function ensureDirPost() {
		var p = state.current;
		if (p.isDir || state.demo || p.type !== "post") return Promise.resolve();
		readForm(p);
		var newPath = CONFIG.dirs.post + p.slug + "/index.md";
		var oldPath = p.path;
		var oldSha = p.sha;
		var msg = "post: 《" + p.title + "》转为目录形式以便配图（手机端）";
		return gh(
			"/repos/" +
				CONFIG.owner +
				"/" +
				CONFIG.repo +
				"/contents/" +
				encPath(newPath),
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: msg,
					content: b64encode(buildFile(p)),
					branch: CONFIG.branch,
				}),
			},
		).then((j) => {
			var newSha = j.content.sha;
			return gh(
				"/repos/" +
					CONFIG.owner +
					"/" +
					CONFIG.repo +
					"/contents/" +
					encPath(oldPath),
				{
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: msg,
						sha: oldSha,
						branch: CONFIG.branch,
					}),
				},
			)
				.catch(() => {
					/* 旧文件删除失败不影响流程 */
				})
				.then(() => {
					localStorage.removeItem(draftKey(oldPath));
					state.posts = state.posts.filter((x) => x.path !== oldPath);
					p.path = newPath;
					p.sha = newSha;
					p.isDir = true;
					state.posts.push(p);
				});
		});
	}

	/* 本地压缩：最长边压到 2000px、JPEG 85%，避免手机原图（动辄数 MB）直接进仓库；
	   GIF 保留原样（canvas 会丢动画），压缩失败一律回退原图。 */
	function compressImage(file) {
		if (file.type === "image/gif") return Promise.resolve(null);
		return createImageBitmap(file)
			.then((bmp) => {
				var scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
				var w = Math.max(1, Math.round(bmp.width * scale));
				var h = Math.max(1, Math.round(bmp.height * scale));
				var canvas = document.createElement("canvas");
				canvas.width = w;
				canvas.height = h;
				var ctx = canvas.getContext("2d");
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, w, h);
				ctx.drawImage(bmp, 0, 0, w, h);
				if (bmp.close) bmp.close();
				return new Promise((resolve) => {
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								resolve(null);
								return;
							}
							blob.arrayBuffer().then((ab) => {
								resolve({ bytes: new Uint8Array(ab), ext: "jpg" });
							});
						},
						"image/jpeg",
						0.85,
					);
				});
			})
			.catch(() => null);
	}

	function readFileBytes(file) {
		return new Promise((resolve, reject) => {
			var reader = new FileReader();
			reader.onload = () => {
				resolve(new Uint8Array(reader.result));
			};
			reader.onerror = () => {
				reject({ message: "读取图片失败：" + file.name });
			};
			reader.readAsArrayBuffer(file);
		});
	}

	/* 生成图片文件名：日期 + 时间戳 + 原名（清洗过），避免重名 */
	function imgName(file, compressed) {
		var base =
			file.name
				.replace(/\.[^.]+$/, "")
				.replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
				.replace(/^-+|-+$/g, "") || "img";
		var ext = compressed
			? "jpg"
			: (
					(/\.(jpe?g|png|webp|gif|avif|bmp)$/i.exec(file.name) || [])[1] || "jpg"
				)
					.toLowerCase()
					.replace("jpeg", "jpg");
		return (
			today().replace(/-/g, "") +
			"-" +
			Date.now().toString(36) +
			"-" +
			base +
			"." +
			ext
		);
	}

	function uploadImage(file) {
		var p = state.current;
		return compressImage(file).then((c) => {
			var name = imgName(file, c);
			var alt = name.replace(/^\d+-[a-z0-9]+-/, "").replace(/\.\w+$/, "");
			var bytes = c ? Promise.resolve(c.bytes) : readFileBytes(file);
			return bytes
				.then((data) => {
					if (state.demo) {
						insertAtCursor("\n![" + alt + "](./" + name + ")\n");
						return null;
					}
					/* 图片放进当前类型的目录：随笔在文章目录下（无扩展名正文引用 ./ 名），学习理解平铺在 learning/ 下 */
					var dir = CONFIG.dirs[p.type] || CONFIG.dirs.post;
					var path = (p.isDir ? dir + p.slug + "/" : dir) + name;
					return gh(
						"/repos/" +
							CONFIG.owner +
							"/" +
							CONFIG.repo +
							"/contents/" +
							encPath(path),
						{
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								message:
									p.type +
									": 《" +
									(p.title || p.slug) +
									"》添加配图 " +
									name +
									"（手机端）",
								content: bytesToB64(data),
								branch: CONFIG.branch,
							}),
						},
					).then(() => {
						insertAtCursor(
							"\n![" + alt + "](" + (p.isDir ? "./" + name : name) + ")\n",
						);
					});
				})
				.then(() => {
					var msg = c
						? "图片已压缩至约 " +
							Math.max(1, Math.round(c.bytes.length / 1024)) +
							" KB 并插入正文，记得点保存"
						: "图片已插入正文，记得点保存";
					toast(msg);
				});
		});
	}

	/* ---------- 生活记录照片 ---------- */

	/* 照片路径是站点绝对路径（/life/xxx.jpg）；APK 内 file:// 需拼上站点地址 */
	function photoUrl(src) {
		if (/^https?:\/\//.test(src)) return src;
		return CONFIG.siteUrl.replace(/\/+$/, "") + src;
	}

	function renderPhotoGrid() {
		var p = state.current;
		var grid = $("life-photo-grid");
		grid.innerHTML = "";
		var photos = (p && p.photos) || [];
		$("photo-empty-tip").hidden = photos.length > 0;
		photos.forEach((src, i) => {
			var item = document.createElement("div");
			item.className = "photo-item";
			var img = document.createElement("img");
			img.src = photoUrl(src);
			img.alt = "照片 " + (i + 1);
			img.loading = "lazy";
			var del = document.createElement("button");
			del.type = "button";
			del.className = "photo-del";
			del.setAttribute("aria-label", "移除照片");
			del.innerHTML = '<i data-lucide="x"></i>';
			del.addEventListener("click", () => {
				p.photos.splice(i, 1);
				renderPhotoGrid();
				markDirty();
			});
			item.appendChild(img);
			item.appendChild(del);
			grid.appendChild(item);
		});
		icons();
	}

	/* 生活照片：压缩后上传到 public/life/，把路径追加进 photos 列表；
	   只更新 frontmatter 引用，不删仓库里的旧图片文件（可在 GitHub 上手动清理） */
	function uploadLifePhotos(files) {
		var p = state.current;
		if (!p.photos) p.photos = [];
		return mapLimit(files, 2, (f) => {
			return compressImage(f).then((c) => {
				var name = imgName(f, c);
				var bytes = c ? Promise.resolve(c.bytes) : readFileBytes(f);
				return bytes.then((data) => {
					if (state.demo) {
						p.photos.push("/life/" + name);
						return null;
					}
					return gh(
						"/repos/" +
							CONFIG.owner +
							"/" +
							CONFIG.repo +
							"/contents/" +
							encPath("public/life/" + name),
						{
							method: "PUT",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								message:
									"life: 《" +
									(p.title || p.slug) +
									"》添加照片 " +
									name +
									"（手机端）",
								content: bytesToB64(data),
								branch: CONFIG.branch,
							}),
						},
					).then(() => {
						p.photos.push("/life/" + name);
					});
				});
			});
		}).then(() => {
			renderPhotoGrid();
			markDirty();
			toast("照片已上传，记得点保存");
		});
	}

	$("btn-life-add-photo").addEventListener("click", () => {
		$("img-input").click();
	});

	function insertAtCursor(text) {
		var ta = $("f-body");
		var s = ta.selectionStart,
			e = ta.selectionEnd;
		ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
		var pos = s + text.length;
		ta.setSelectionRange(pos, pos);
		ta.focus();
		markDirty();
	}

	/* ---------- 新建文章 ---------- */

	function slugify(title) {
		var t = title
			.trim()
			.toLowerCase()
			.replace(/[^\w\u4e00-\u9fa5]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return /^[a-z0-9][a-z0-9-]*$/.test(t) ? t : "post-" + today();
	}

	var slugEdited = false;

	function currentNewType() {
		var checked = document.querySelector(
			'#new-type-selector input[name="new-type"]:checked',
		);
		return (checked && checked.value) || "post";
	}

	function updateSlugDemo() {
		var type = currentNewType();
		var slug = $("f-new-slug").value || "…";
		$("slug-demo").textContent =
			type === "post" ? "/posts/" + slug + "/" : "/" + type + "/" + slug + ".md";
	}

	function syncNewTypeUI() {
		var type = currentNewType();
		Array.prototype.forEach.call(
			document.querySelectorAll("#new-type-selector .type-card"),
			(c) => {
				c.classList.toggle("selected", c.getAttribute("data-type") === type);
			},
		);
		$("dlg-lbl-title").textContent = type === "life" ? "标题（可选）" : "标题";
		updateSlugDemo();
	}

	$("new-type-selector").addEventListener("change", syncNewTypeUI);

	function openNewDialog() {
		$("f-new-title").value = "";
		$("f-new-slug").value = "";
		slugEdited = false;
		var postRadio = document.querySelector(
			'#new-type-selector input[value="post"]',
		);
		if (postRadio) postRadio.checked = true;
		syncNewTypeUI();
		hideErr($("new-error"));
		$("dlg-new").hidden = false;
		$("f-new-title").focus();
	}

	$("f-new-title").addEventListener("input", () => {
		if (!slugEdited) $("f-new-slug").value = slugify($("f-new-title").value);
		updateSlugDemo();
	});
	$("f-new-slug").addEventListener("input", () => {
		slugEdited = true;
		updateSlugDemo();
	});

	$("btn-new-cancel").addEventListener("click", () => {
		$("dlg-new").hidden = true;
	});

	$("btn-new-create").addEventListener("click", () => {
		var type = currentNewType();
		var title = $("f-new-title").value.trim();
		var slug = $("f-new-slug").value.trim();
		hideErr($("new-error"));
		if (type !== "life" && !title) {
			showErr($("new-error"), "请填写标题");
			return;
		}
		if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
			showErr($("new-error"), "链接名只能用小写英文、数字和短横线");
			return;
		}
		/* 随笔是目录形式（slug/index.md），学习/生活是单文件（slug.md），与仓库现有内容一致 */
		var path =
			type === "post"
				? CONFIG.dirs.post + slug + "/index.md"
				: CONFIG.dirs[type] + slug + ".md";
		if (state.posts.some((p) => p.path === path)) {
			showErr($("new-error"), "已存在同名内容，换一个链接名");
			return;
		}
		var p = {
			slug: slug,
			path: path,
			isDir: type === "post",
			type: type,
			title: type === "life" ? title : title || slug,
			date: today(),
			draft: true,
			description: "",
			tags: [],
			category: "",
			photos: [],
			attrs: {},
			lists: {},
			order: [],
			body: "",
			sha: null,
		};
		$("dlg-new").hidden = true;
		openPost(p);
		toast(state.demo ? "演示模式开始写" : "已创建草稿，写完记得点保存");
	});

	/* ---------- 演示模式 ---------- */

	function demoTree() {
		var mk = (type, slug, title, date, draft, desc, tags, cat, body) => {
			var p = {
				slug: slug,
				path:
					type === "post"
						? CONFIG.dirs.post + slug + "/index.md"
						: CONFIG.dirs[type] + slug + ".md",
				isDir: type === "post",
				type: type,
				title: title,
				date: date,
				draft: draft,
				description: desc,
				tags: tags,
				category: cat,
				photos: type === "life" ? ["/life/test-a.jpg", "/life/test-b.jpg"] : [],
				attrs: {},
				lists: {},
				order: [],
				body: body,
				sha: "demo-" + slug,
				demo: true,
			};
			p.raw = buildFile(p);
			return p;
		};
		state.posts = [
			mk(
				"post",
				"qingdao-notes",
				"旅行随笔·青岛两天",
				"2026-10-21",
				true,
				"两天一夜，海边、啤酒和老城区。",
				["旅行", "生活"],
				"随笔",
				"## 写在前面\n\n两天一夜，记录一下这座海滨城市。\n\n- 栈桥早上去人最少\n- 啤酒博物馆记得提前买票\n\n写完点右上角保存，一分钟内自动上线。",
			),
			mk(
				"learning",
				"agent-notes",
				"用 Agent 自动整理学习笔记",
				"2026-10-12",
				false,
				"让 Agent 帮我做笔记的实践记录。",
				[],
				"",
				"最近在尝试把课堂笔记交给 Agent 整理。\n\n## 做法\n\n1. 拍照转文字\n2. 让 Agent 归纳要点\n3. 人工复核一遍",
			),
			mk(
				"post",
				"markdown-template",
				"Markdown 写作速查模板",
				"2026-09-28",
				false,
				"常用语法备忘。",
				["Markdown"],
				"技术",
				"常用语法备忘：**加粗**、*斜体*、`代码`。",
			),
			mk(
				"life",
				"sunset-walk",
				"海边散步",
				"2026-09-20",
				false,
				"",
				[],
				"",
				"傍晚去海边走了一圈，风很舒服，顺手拍了两张。",
			),
			mk(
				"post",
				"hello-world",
				"开始",
				"2026-09-03",
				false,
				"第一篇博客，顺便演示这个主题支持的 Markdown 写法。",
				["博客", "起步"],
				"随笔",
				"这是本博客的第一篇文章。\n\n## 写在前面\n\n- 单文件：`文章名.md`\n- 目录形式：`文章名/index.md`\n\n写完点右上角保存，一分钟内自动上线。",
			),
		];
		return { tree: [] };
	}

	if (state.demo) {
		state.token = "";
	}

	/* ---------- 启动 ---------- */

	icons();
	if (state.demo) {
		loadList();
		setTimeout(() => {
			toast("演示模式：数据为本地模拟，加 ?demo 访问");
		}, 400);
	} else if (state.token) {
		loadList();
	} else {
		showScreen("auth");
	}

	if (
		"serviceWorker" in navigator &&
		(location.protocol === "https:" || location.hostname === "localhost")
	) {
		navigator.serviceWorker.register("./sw.js").catch(() => {
			/* SW 不可用不影响功能 */
		});
	}
})();
