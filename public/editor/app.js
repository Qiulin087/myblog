/* 博客编辑器（PWA）—— 通过 GitHub Contents API 直接管理 src/content/posts 下的文章。
   无后端：token 保存在浏览器本地，所有写操作都作为一次 git 提交，由 Vercel 自动部署。 */
(function () {
	"use strict";

	var CONFIG = {
		owner: "Qiulin087",
		repo: "myblog",
		branch: "main",
		postsDir: "src/content/posts/",
		siteUrl: "https://myblog-qiulin1.vercel.app/",
	};

	var API = "https://api.github.com";
	var LS_TOKEN = "be:token";

	/* ---------- 工具 ---------- */

	function $(id) { return document.getElementById(id); }

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

	function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

	function today() {
		var d = new Date();
		return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
	}

	function unq(v) {
		v = String(v == null ? "" : v).trim();
		if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
			return v.slice(1, -1);
		}
		return v;
	}

	function parseTags(v) {
		v = unq(v);
		if (!v) return [];
		var inner = v.replace(/^\[/, "").replace(/\]$/, "");
		return inner.split(",").map(function (s) { return unq(s); }).filter(Boolean);
	}

	/* 生成 YAML 字符串标量：
	   空串以及会被 YAML 解析成 null/布尔/数字（含 2026 这类纯数字）的值必须加引号，
	   否则内容集合的 z.string() 校验会失败；含英文冒号等不安全字符的值也一律加引号。 */
	function qv(v) {
		v = String(v == null ? "" : v);
		if (
			v === "" ||
			/^(null|~|true|false|yes|no|on|off|[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?|[-+]?\.(inf|Inf|INF)|\.(nan|NaN|NAN))$/i.test(v)
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
			return Promise.resolve().then(function () { return fn(items[my], my); }).then(function (r) { ret[my] = r; }).then(worker);
		}
		var workers = [];
		for (var i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
		return Promise.all(workers).then(function () { return ret; });
	}

	function icons() {
		if (window.lucide) window.lucide.createIcons();
	}

	/* ---------- GitHub API ---------- */

	function gh(path, opts) {
		opts = opts || {};
		var headers = { Accept: "application/vnd.github+json" };
		if (state.token) headers.Authorization = "Bearer " + state.token;
		if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
		return fetch(API + path, {
			method: opts.method || "GET",
			headers: headers,
			body: opts.body,
		}).then(function (res) {
			if (res.status === 401) throw { kind: "auth", message: "token 无效或已过期，请重新设置" };
			if (res.status === 409) throw { kind: "conflict", message: "文章已在别处被修改，请刷新列表后重试" };
			if (!res.ok) {
				return res.json().catch(function () { return {}; }).then(function (j) {
					throw { kind: "api", status: res.status, message: j && j.message ? j.message : "GitHub API 错误 " + res.status };
				});
			}
			return res.json();
		});
	}

	/* ---------- frontmatter ---------- */

	function parseFrontmatter(raw) {
		var m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(raw);
		if (!m) return { attrs: {}, order: [], body: raw };
		var attrs = {}, order = [];
		m[1].split(/\r?\n/).forEach(function (line) {
			var t = line.trim();
			if (!t || t.charAt(0) === "#") return;
			var mm = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(t);
			if (!mm) return;
			attrs[mm[1]] = mm[2];
			order.push(mm[1]);
		});
		return { attrs: attrs, order: order, body: raw.slice(m[0].length) };
	}

	var MANAGED = ["title", "published", "description", "tags", "category", "draft"];
	var MANAGED_SET = new Set(MANAGED);

	function buildPostFile(p) {
		var lines = [
			"title: " + qv(p.title),
			"published: " + (p.date || today()),
			"description: " + qv(p.description),
		];
		(p.order || []).forEach(function (k) {
			if (!MANAGED_SET.has(k)) lines.push(k + ": " + p.attrs[k]);
		});
		lines.push("tags: [" + p.tags.map(qv).join(", ") + "]");
		lines.push("category: " + qv(p.category));
		lines.push("draft: " + (p.draft ? "true" : "false"));
		return "---\n" + lines.join("\n") + "\n---\n" + p.body;
	}

	/* ---------- 状态 ---------- */

	var state = {
		token: localStorage.getItem(LS_TOKEN) || "",
		demo: new URLSearchParams(location.search).has("demo"),
		posts: [],
		current: null,
		serverBody: "",
		dirty: false,
		saving: false,
	};

	function draftKey(path) { return "be:draft:" + path; }

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
		toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
	}

	function setHint(mode) {
		var h = $("save-hint");
		h.classList.remove("ok", "busy");
		if (mode === "saved") { h.classList.add("ok"); h.innerHTML = '<i data-lucide="circle-check"></i>已保存'; }
		else if (mode === "busy") { h.classList.add("busy"); h.innerHTML = '<i data-lucide="refresh-cw"></i>提交中…'; }
		else { h.innerHTML = '<i data-lucide="pencil-line"></i>未保存'; }
		icons();
	}

	function showErr(el, msg) { el.textContent = msg; el.hidden = false; }
	function hideErr(el) { el.hidden = true; }

	/* ---------- 授权 ---------- */

	$("auth-domain").textContent = CONFIG.owner + "/" + CONFIG.repo;

	$("btn-auth-save").addEventListener("click", function () {
		var tk = $("f-token").value.trim();
		hideErr($("auth-error"));
		if (!tk) { showErr($("auth-error"), "请先粘贴 token"); return; }
		var btn = $("btn-auth-save");
		btn.disabled = true;
		state.token = tk;
		gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo).then(function () {
			state.token = tk;
			localStorage.setItem(LS_TOKEN, tk);
			toast("token 有效，已保存");
			loadList();
		}).catch(function (e) {
			state.token = localStorage.getItem(LS_TOKEN) || "";
			showErr($("auth-error"), e.message || "验证失败，请检查 token 和网络");
		}).finally(function () { btn.disabled = false; });
	});

	$("btn-settings").addEventListener("click", function () {
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
			prep = gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/git/trees/" + CONFIG.branch + "?recursive=1").then(function (tree) {
				var entries = collectPosts(tree);
				return mapLimit(entries, 6, function (post) {
					return gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(post.path)).then(function (j) {
						post.sha = j.sha;
						applyRaw(post, b64decode(j.content || ""));
					});
				}).then(function () { return entries; });
			});
		}
		prep.then(function (entries) {
			if (!state.demo) state.posts = entries;
			state.posts.sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || a.slug.localeCompare(b.slug); });
			renderList();
		}).catch(function (e) {
			listState('<i data-lucide="cloud-off"></i><span>' + esc(e.message || "加载失败") + "</span>");
			var retry = document.createElement("button");
			retry.className = "pill-btn";
			retry.type = "button";
			retry.textContent = "重试";
			retry.addEventListener("click", loadList);
			$("post-list").querySelector(".list-state").appendChild(retry);
			if (e.kind === "auth") { $("f-token").value = state.token || ""; showScreen("auth"); showErr($("auth-error"), e.message); }
		});
		icons();
	}

	function collectPosts(tree) {
		var dir = CONFIG.postsDir;
		var found = new Map();
		(tree.tree || []).forEach(function (item) {
			if (item.type !== "blob") return;
			if (item.path.indexOf(dir) !== 0) return;
			var rel = item.path.slice(dir.length);
			var m = /^(.*)\/index\.md$/.exec(rel);
			if (m) {
				found.set(m[1], { slug: m[1], path: item.path, isDir: true });
			} else if (/\.md$/.test(rel)) {
				var slug = rel.slice(0, -3);
				if (!found.has(slug)) found.set(slug, { slug: slug, path: item.path, isDir: false });
			}
		});
		var arr = [];
		found.forEach(function (v) {
			v.title = v.slug;
			v.date = "";
			v.draft = false;
			v.description = "";
			v.tags = [];
			v.category = "";
			v.attrs = {};
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
		post.order = fm.order;
		post.body = fm.body;
		post.title = unq(fm.attrs.title) || post.slug;
		post.date = unq(fm.attrs.published).slice(0, 10);
		post.draft = unq(fm.attrs.draft) === "true";
		post.description = unq(fm.attrs.description);
		post.tags = parseTags(fm.attrs.tags);
		post.category = unq(fm.attrs.category);
	}

	function renderList() {
		var box = $("post-list");
		if (!state.posts.length) {
			listState('<i data-lucide="feather"></i><span>还没有文章，点下方按钮开始写第一篇</span>');
			return;
		}
		box.innerHTML = "";
		state.posts.forEach(function (p) {
			var b = document.createElement("button");
			b.type = "button";
			b.className = "post";
			b.innerHTML =
				'<span class="dot ' + (p.draft ? "draft" : "pub") + '"></span>' +
				'<span class="p-main"><span class="p-title">' + esc(p.title) + "</span>" +
				'<span class="p-meta">' + esc(p.date || "未填日期") + " · <em" + (p.draft ? ' class="draft"' : "") + ">" + (p.draft ? "草稿" : "已发布") + "</em></span></span>" +
				'<i data-lucide="chevron-right"></i>';
			b.addEventListener("click", function () { openPost(p); });
			box.appendChild(b);
		});
		icons();
	}

	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
		});
	}

	$("btn-refresh").addEventListener("click", function () { if (!state.demo) loadList(); else { renderList(); toast("演示模式：数据为本地模拟"); } });
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
		p.title = $("f-title").value.trim() || p.slug;
		p.category = $("f-cat").value.trim();
		p.tags = $("f-tags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
		p.description = $("f-desc").value.trim();
		p.draft = $("f-draft").checked;
		p.date = $("f-date").value || today();
		p.body = $("f-body").value;
	}

	function openPost(p) {
		state.current = p;
		state.serverBody = p.body || "";
		state.openSnapshot = {
			title: p.title, cat: p.category, tags: p.tags.slice(), desc: p.description,
			draft: p.draft, date: p.date, body: p.body,
		};
		$("edit-title").textContent = p.title;
		$("edit-state").textContent = "正在编辑 · " + p.path.replace(CONFIG.postsDir, "");
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
					p.title = d.title; p.category = d.cat; p.tags = d.tags; p.description = d.desc;
					p.draft = d.draft; p.date = d.date; p.body = d.body;
					fillForm(p);
					state.dirty = true;
					setHint("dirty");
					$("draft-banner").hidden = false;
				}
			} catch (e) { /* 忽略损坏的本地草稿 */ }
		}
		showScreen("edit");
		switchTab("write");
		icons();
	}

	function autosaveDraft() {
		var p = state.current;
		if (!p) return;
		readForm(p);
		try {
			localStorage.setItem(draftKey(p.path), JSON.stringify({
				title: p.title, cat: p.category, tags: p.tags, desc: p.description,
				draft: p.draft, date: p.date, body: p.body, at: Date.now(),
			}));
		} catch (e) { /* 存储满等异常忽略 */ }
	}

	var autosaveTimer = null;
	function markDirty() {
		state.dirty = true;
		setHint("dirty");
		clearTimeout(autosaveTimer);
		autosaveTimer = setTimeout(autosaveDraft, 600);
	}

	["f-title", "f-cat", "f-tags", "f-desc", "f-body"].forEach(function (id) {
		$(id).addEventListener("input", markDirty);
	});
	$("f-draft").addEventListener("change", markDirty);
	$("f-date").addEventListener("change", markDirty);

	$("btn-discard-draft").addEventListener("click", function () {
		var p = state.current;
		if (!p) return;
		localStorage.removeItem(draftKey(p.path));
		var s = state.openSnapshot;
		p.title = s.title; p.category = s.cat; p.tags = s.tags; p.description = s.desc;
		p.draft = s.draft; p.date = s.date; p.body = s.body;
		fillForm(p);
		state.dirty = false;
		setHint("saved");
		$("draft-banner").hidden = true;
		toast("已还原为线上版本");
	});

	$("btn-back").addEventListener("click", function () {
		if (state.dirty) toast("本地草稿已暂存，记得回来保存");
		state.current = null;
		loadList();
	});

	/* ---------- 选项卡：编辑 / 预览 ---------- */

	function renderPreview() {
		var src = $("f-body").value;
		if (!window.marked) { $("preview").textContent = src; return; }
		var md = src.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (all, alt, srcp) {
			if (/^https?:\/\//.test(srcp)) return all;
			var name = srcp.split("/").pop();
			return '<div class="be-img-slot"><i data-lucide="image"></i><span>' + esc(alt || "图片") + " · " + esc(name) + "</span></div>";
		});
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

	$("tab-write").addEventListener("click", function () { switchTab("write"); });
	$("tab-prev").addEventListener("click", function () { switchTab("prev"); });

	/* ---------- 保存 ---------- */

	$("btn-save").addEventListener("click", function () {
		if (state.saving || !state.current) return;
		var p = state.current;
		readForm(p);
		if (!p.title || p.title === p.slug && !$("f-title").value.trim()) {
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
		var msg = (isNew ? "post: 新增《" : "post: 编辑《") + p.title + "》（手机端）";
		var body = { message: msg, content: b64encode(buildPostFile(p)), branch: CONFIG.branch };
		if (p.sha) body.sha = p.sha;
		gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(p.path), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}).then(function (j) {
			p.sha = j.content.sha;
			var raw = buildPostFile(p);
			applyRaw(p, raw);
			localStorage.removeItem(draftKey(p.path));
			state.dirty = false;
			setHint("saved");
			$("edit-state").textContent = "正在编辑 · " + p.path.replace(CONFIG.postsDir, "");
			if (!state.posts.some(function (x) { return x.path === p.path; })) state.posts.push(p);
			toast(isNew ? "已提交，约 1 分钟后线上生效" : "已保存，约 1 分钟后线上生效");
		}).catch(function (e) {
			setHint("dirty");
			if (e.kind === "auth") { $("f-token").value = state.token || ""; showScreen("auth"); showErr($("auth-error"), e.message); }
			else toast(e.message || "保存失败，请重试");
		}).finally(function () {
			state.saving = false;
			$("btn-save").disabled = false;
		});
	});

	/* ---------- 删除 ---------- */

	$("btn-del").addEventListener("click", function () {
		var p = state.current;
		if (!p || !p.sha) { toast("新建的还未保存，直接返回即可"); return; }
		if (!confirm("删除《" + p.title + "》？\n会提交一次删除记录，可在 GitHub 上回滚。")) return;
		if (state.demo) { toast("演示模式：未真正删除"); return; }
		var btn = $("btn-del");
		btn.disabled = true;
		var job;
		if (p.isDir) {
			job = gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(p.path)).then(function (listing) {
				return mapLimit(listing, 3, function (item) {
					return gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(item.path), {
						method: "DELETE",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ message: "post: 删除 " + item.path + "（手机端）", sha: item.sha, branch: CONFIG.branch }),
					});
				});
			});
		} else {
			job = gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(p.path), {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "post: 删除《" + p.title + "》（手机端）", sha: p.sha, branch: CONFIG.branch }),
			});
		}
		job.then(function () {
			localStorage.removeItem(draftKey(p.path));
			state.posts = state.posts.filter(function (x) { return x.path !== p.path; });
			toast("已删除");
			state.current = null;
			loadList();
		}).catch(function (e) {
			toast(e.message || "删除失败，请重试");
		}).finally(function () { btn.disabled = false; });
	});

	/* ---------- 图片 ---------- */

	$("btn-img").addEventListener("click", function () { $("img-input").click(); });

	$("img-input").addEventListener("change", function () {
		var files = Array.prototype.slice.call(this.files || []);
		this.value = "";
		if (!files.length || !state.current) return;
		ensureDirPost().then(function () {
			return mapLimit(files, 2, function (f) { return uploadImage(f); });
		}).catch(function (e) {
			if (e.kind === "auth") { $("f-token").value = state.token || ""; showScreen("auth"); showErr($("auth-error"), e.message); }
			else toast(e.message || "图片上传失败");
		});
	});

	/* 单文件文章首次插图时转为目录形式（slug/index.md），图片才有归属 */
	function ensureDirPost() {
		var p = state.current;
		if (p.isDir || state.demo) return Promise.resolve();
		readForm(p);
		var newPath = CONFIG.postsDir + p.slug + "/index.md";
		var oldPath = p.path;
		var oldSha = p.sha;
		var msg = "post: 《" + p.title + "》转为目录形式以便配图（手机端）";
		return gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(newPath), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: msg, content: b64encode(buildPostFile(p)), branch: CONFIG.branch }),
		}).then(function (j) {
			var newSha = j.content.sha;
			return gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(oldPath), {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: msg, sha: oldSha, branch: CONFIG.branch }),
			}).catch(function () { /* 旧文件删除失败不影响流程 */ }).then(function () {
				localStorage.removeItem(draftKey(oldPath));
				state.posts = state.posts.filter(function (x) { return x.path !== oldPath; });
				p.path = newPath;
				p.sha = newSha;
				p.isDir = true;
				state.posts.push(p);
			});
		});
	}

	function uploadImage(file) {
		var p = state.current;
		var base = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "") || "img";
		var ext = (/\.(jpe?g|png|webp|gif|avif|bmp)$/i.exec(file.name) || [])[1] || "jpg";
		ext = ext.toLowerCase().replace("jpeg", "jpg");
		var name = today().replace(/-/g, "") + "-" + base + "." + ext;
		var alt = base;
		var reader = new FileReader();
		return new Promise(function (resolve, reject) {
			reader.onload = function () { resolve(new Uint8Array(reader.result)); };
			reader.onerror = function () { reject({ message: "读取图片失败：" + file.name }); };
			reader.readAsArrayBuffer(file);
		}).then(function (bytes) {
			if (state.demo) { insertAtCursor("\n![" + alt + "](./" + name + ")\n"); return null; }
			var path = CONFIG.postsDir + p.slug + "/" + name;
			return gh("/repos/" + CONFIG.owner + "/" + CONFIG.repo + "/contents/" + encPath(path), {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: "post: 《" + p.title + "》添加配图 " + name + "（手机端）",
					content: bytesToB64(bytes),
					branch: CONFIG.branch,
				}),
			}).then(function () {
				insertAtCursor("\n![" + alt + "](./" + name + ")\n");
			});
		}).then(function () {
			toast("图片已插入正文，记得点保存");
		});
	}

	function insertAtCursor(text) {
		var ta = $("f-body");
		var s = ta.selectionStart, e = ta.selectionEnd;
		ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
		var pos = s + text.length;
		ta.setSelectionRange(pos, pos);
		ta.focus();
		markDirty();
	}

	/* ---------- 新建文章 ---------- */

	function slugify(title) {
		var t = title.trim().toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
		return /^[a-z0-9][a-z0-9-]*$/.test(t) ? t : "post-" + today();
	}

	var slugEdited = false;

	function openNewDialog() {
		$("f-new-title").value = "";
		$("f-new-slug").value = "";
		slugEdited = false;
		hideErr($("new-error"));
		$("dlg-new").hidden = false;
		$("f-new-title").focus();
	}

	$("f-new-title").addEventListener("input", function () {
		if (!slugEdited) $("f-new-slug").value = slugify($("f-new-title").value);
		$("slug-demo").textContent = "/posts/" + ($("f-new-slug").value || "…") + "/";
	});
	$("f-new-slug").addEventListener("input", function () { slugEdited = true; $("slug-demo").textContent = "/posts/" + ($("f-new-slug").value || "…") + "/"; });

	$("btn-new-cancel").addEventListener("click", function () { $("dlg-new").hidden = true; });

	$("btn-new-create").addEventListener("click", function () {
		var title = $("f-new-title").value.trim();
		var slug = $("f-new-slug").value.trim();
		hideErr($("new-error"));
		if (!title) { showErr($("new-error"), "请填写标题"); return; }
		if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) { showErr($("new-error"), "链接名只能用小写英文、数字和短横线"); return; }
		if (state.posts.some(function (p) { return p.slug === slug; })) { showErr($("new-error"), "已存在同名文章，换一个链接名"); return; }
		var p = {
			slug: slug,
			path: CONFIG.postsDir + slug + "/index.md",
			isDir: true,
			title: title,
			date: today(),
			draft: true,
			description: "",
			tags: [],
			category: "",
			attrs: {},
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
		var mk = function (slug, title, date, draft, desc, tags, cat, body) {
			var p = {
				slug: slug, path: CONFIG.postsDir + slug + "/index.md", isDir: true,
				title: title, date: date, draft: draft, description: desc, tags: tags, category: cat,
				attrs: {}, order: ["lang"], body: body, sha: "demo-" + slug, demo: true,
			};
			p.attrs.lang = "";
			p.raw = buildPostFile(p);
			return p;
		};
		state.posts = [
			mk("hello-world", "开始", "2026-09-03", false, "第一篇博客，顺便演示这个主题支持的 Markdown 写法。", ["博客", "起步"], "随笔", "这是本博客的第一篇文章。\n\n## 写在前面\n\n- 单文件：`文章名.md`\n- 目录形式：`文章名/index.md`\n\n写完点右上角保存，一分钟内自动上线。"),
			mk("qingdao-notes", "旅行随笔·青岛两天", "2026-10-21", true, "两天一夜，海边、啤酒和老城区。", ["旅行", "生活"], "随笔", "## 写在前面\n\n两天一夜，记录一下这座海滨城市。\n\n- 栈桥早上去人最少\n- 啤酒博物馆记得提前买票\n\n写完点右上角保存，一分钟内自动上线。"),
			mk("agent-notes", "用 Agent 自动整理学习笔记", "2026-10-12", false, "让 Agent 帮我做笔记的实践记录。", ["Agent", "学习"], "技术", "最近在尝试把课堂笔记交给 Agent 整理。\n\n## 做法\n\n1. 拍照转文字\n2. 让 Agent 归纳要点\n3. 人工复核一遍"),
			mk("markdown-template", "Markdown 写作速查模板", "2026-09-28", false, "常用语法备忘。", ["Markdown"], "技术", "常用语法备忘：**加粗**、*斜体*、`代码`。"),
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
		setTimeout(function () { toast("演示模式：数据为本地模拟，加 ?demo 访问"); }, 400);
	} else if (state.token) {
		loadList();
	} else {
		showScreen("auth");
	}

	if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
		navigator.serviceWorker.register("./sw.js").catch(function () { /* SW 不可用不影响功能 */ });
	}
})();
