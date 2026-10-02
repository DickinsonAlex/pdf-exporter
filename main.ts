import {
	MarkdownRenderer,
	Notice,
	Modal,
	Plugin
} from "obsidian";

export default class PdfExportPlugin extends Plugin {
	async onload() {
		this.addRibbonIcon("file-down", "Export note as PDF", async () => {
			await this.exportActiveNoteToPdf();
		}).addClass("my-plugin-ribbon"); // grouped by the ribbon-groups snippet

		this.addCommand({
			id: "export-active-note-to-pdf",
			name: "Export active note to PDF",
			callback: async () => {
				await this.exportActiveNoteToPdf();
			}
		});
	}

	async exportActiveNoteToPdf(): Promise<void> {
		const file = this.app.workspace.getActiveFile();

		if (!file || file.extension !== "md") {
			new Notice("Open a markdown note first.");
			return;
		}

		try {
			const markdown = await this.app.vault.read(file);
			const preparedMarkdown = this.prepareMarkdownForPdf(markdown);

			const renderContainer = document.createElement("div");
			renderContainer.className = "resume-export-root markdown-rendered";

			await MarkdownRenderer.render(
				this.app,
				preparedMarkdown,
				renderContainer,
				file.path,
				this
			);

			await this.waitForEmbeds(renderContainer);
			const blocks = this.flattenBlocks(renderContainer);
			renderContainer.replaceChildren(...blocks);

			this.normalizeResumeHeader(renderContainer);
			this.normalizeSplitHeadings(renderContainer);
			this.groupForPrint(renderContainer);

			const html = this.buildPrintHtml(renderContainer.innerHTML, file.basename);
			new ResumePreviewModal(this.app, html, file.basename).open();

			new Notice("Opened PDF preview.");
		} catch (error) {
			console.error("Resume PDF export failed:", error);
			new Notice("Failed to export PDF. Check the console.");
		}
	}

	buildPrintHtml(renderedHtml: string, title: string): string {
		const pluginStyles = this.getResumeStyles();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(title)}</title>
	<style>
		${pluginStyles}
		${this.getSheetStyles()}
	</style>
</head>
<body>
	<div class="page">
		<div class="resume-body markdown-rendered">
			${renderedHtml}
		</div>
	</div>
</body>
</html>`;
	}

	/**
	 * Real A4 sheets. The paginate script moves the content onto fixed-size pages,
	 * so the preview shows exactly where each page ends, and printing uses the
	 * same sheets (one sheet = one printed page), so the PDF matches the preview.
	 */
	getSheetStyles(): string {
		return `
			@page { size: A4; margin: 0; }
			html, body { margin: 0; padding: 0; }
			.sheet {
				width: 210mm;
				height: 297mm;
				padding: 14mm;
				box-sizing: border-box;
				overflow: hidden;
				background: white;
				position: relative;
			}
			.sheet .resume-body { padding: 0; }
			@media screen {
				html, body { background: #d6d6d6; }
				body { padding: 16px 0 24px; }
				.sheet { margin: 0 auto 18px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25); }
				.sheet-label {
					width: 210mm; margin: 0 auto 6px;
					font: 600 10pt Arial, Helvetica, sans-serif; color: #444;
				}
			}
			@media print {
				body { background: white; }
				.sheet-label { display: none; }
				.sheet { break-after: page; page-break-after: always; }
				.sheet:last-of-type { break-after: auto; page-break-after: auto; }
			}
		`;
	}

	prepareMarkdownForPdf(markdown: string): string {
		return markdown
			.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, "")
			.replace(/%%[\s\S]*?%%/g, "")
			.replace(/^\s*<break\s*\/?>\s*$/gim, "\n<div class=\"pdf-page-break\" aria-hidden=\"true\"></div>\n");
	}

	getResumeStyles(): string {
		return `
			@page {
				size: A4;
				margin: 14mm;
			}

			:root {
				--text: #111111;
				--muted: #555555;
				--border: #d9d9d9;
				--heading: #0f172a;
				--accent: #1d4ed8;
			}

			* {
				box-sizing: border-box;
			}

			html, body {
				margin: 0;
				padding: 0;
				background: white;
				color: var(--text);
				font-family: Arial, Helvetica, sans-serif;
				font-size: 10.5pt;
				line-height: 1.28;
			}

			body {
				padding: 0;
			}

			.page {
				width: 210mm;
				min-height: 297mm;
				margin: 0 auto;
				background: white;
				padding: 0;
			}

			.resume-body {
				padding: 0;
				word-wrap: break-word;
			}

			.resume-body h1 {
				font-size: 16pt;
				line-height: 1.05;
				margin: 0 0 4px 0;
				text-align: center;
				font-weight: 700;
				color: var(--heading);
			}

			.resume-body .resume-header-block {
				margin-bottom: 0.7rem;
				text-align: center;
			}

			.resume-body .resume-header-subtitle {
				margin: 0 0 0.45rem 0;
				padding-bottom: 0.28rem;
				font-size: 11pt;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				color: var(--heading);
				border-bottom: 1px solid var(--border);
			}

			.resume-body .resume-header-row {
				display: flex;
				flex-wrap: wrap;
				justify-content: center;
				align-items: center;
				column-gap: 0;
				row-gap: 0.2rem;
				width: 100%;
				font-size: 9pt;
				line-height: 1.2;
				text-align: center;
				color: var(--text);
			}

			.resume-body .resume-header-item {
				display: inline-flex;
				align-items: baseline;
				white-space: nowrap;
			}

			.resume-body .resume-header-separator {
				margin: 0 0.45rem;
				color: var(--muted);
				flex: 0 0 auto;
			}

			.resume-body .resume-header-label {
				font-weight: 600;
				color: var(--muted);
			}

			.resume-body .resume-header-item a {
				color: var(--accent);
				text-decoration: none;
			}

			.resume-body .resume-header-item a:hover {
				text-decoration: underline;
			}

			.resume-body h2 {
				font-size: 14pt;
				text-transform: uppercase;
				letter-spacing: 0.08em;
				margin: 14px 0 6px 0;
				color: var(--heading);
				border-bottom: 1px solid var(--border);
				padding-bottom: 3px;
			}

			.resume-body .resume-split-heading {
				display: flex;
				justify-content: space-between;
				align-items: baseline;
				gap: 12px;
				width: 100%;
				text-align: left;
			}

			.resume-body .resume-split-heading-left,
			.resume-body .resume-split-heading-right {
				display: inline-block;
				max-width: calc(50% - 6px);
			}

			.resume-body .resume-split-heading-right {
				text-align: right;
				margin-left: auto;
			}

			.resume-body h3 {
				font-size: 11.5pt;
				font-weight: 700;
				margin: 10px 0 1px 0;
				color: #000000;
				font-weight: 700;
			}

			.resume-body h4 {
				font-size: 11pt;
				margin: 0 0 5px 0;
				color: #000000;
				font-weight: 600;
			}

			.resume-body h5 {
				font-size: 10.5pt;
				margin: 1px 0 2px 0;
				color: #000000;
				font-weight: 600;
				line-height: 1.1;
				break-after: avoid;
				page-break-after: avoid;
			}

			.resume-body h3,
			.resume-body h4,
			.resume-body h5,
			.resume-body h3 + h4 + ul {
				page-break-inside: avoid;
				break-inside: avoid;
			}

			.resume-body p {
				margin: 0 0 7px 0;
			}

			.resume-body ul {
				margin: 0 0 8px 18px;
				padding: 0;
			}

			.resume-body li {
				margin: 0 0 3px 0;
			}

			.resume-body strong {
				font-weight: 700;
				color: var(--heading);
			}

			.resume-body em {
				font-style: italic;
			}

			.resume-body a {
				color: var(--accent);
				text-decoration: none;
				word-break: break-word;
			}

			.resume-body blockquote {
				margin: 8px 0;
				padding: 6px 10px;
				border-left: 3px solid var(--border);
				color: var(--muted);
				background: #fafafa;
			}

			.resume-body hr {
				border: 0;
				border-top: 1px solid var(--border);
				margin: 12px 0;
			}

			.resume-body .pdf-page-break {
				display: block;
				width: 100%;
				height: 0;
				margin: 14px 0;
				break-before: page;
				page-break-before: always;
				position: relative;
			}

			.resume-body .pdf-page-break::after {
				content: "Page Break";
				display: block;
				margin: -0.4rem 0 0 0;
				padding-top: 0.25rem;
				border-top: 1px dashed var(--border);
				font-size: 8pt;
				line-height: 1;
				text-align: center;
				color: var(--muted);
				letter-spacing: 0.08em;
			}

			.resume-body .internal-link,
			.resume-body .external-link {
				text-decoration: none;
			}

			/* Keep headings with their content: every heading run + its content is one
			   unbreakable group, and each h2 is glued to its first group. */
			.resume-body .resume-keep,
			.resume-body .resume-entry {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			.resume-body h1,
			.resume-body h2,
			.resume-body h3,
			.resume-body h4,
			.resume-body h5,
			.resume-body h6 {
				break-after: avoid;
				page-break-after: avoid;
			}

			.resume-body p,
			.resume-body li {
				orphans: 3;
				widows: 3;
			}

			.resume-body li {
				break-inside: avoid;
				page-break-inside: avoid;
			}

			@media print {
				html, body {
					background: white;
					padding: 0;
				}

				.page {
					width: auto;
					min-height: auto;
					box-shadow: none;
					margin: 0;
				}

				.resume-body .pdf-page-break::after {
					content: none;
				}

				a {
					color: inherit;
				}
			}
		`;
	}

	normalizeResumeHeader(container: HTMLElement): void {
		const heading = container.querySelector("h1");
		if (!heading) {
			return;
		}

		const list = heading.nextElementSibling;
		if (!list || list.tagName !== "UL") {
			return;
		}

		const headerBlock = document.createElement("div");
		headerBlock.className = "resume-header-block";

		const subtitle = document.createElement("div");
		subtitle.className = "resume-header-subtitle";

		const contactRow = document.createElement("div");
		contactRow.className = "resume-header-row";
		const contactItems: HTMLElement[] = [];

		for (const listItem of Array.from(list.querySelectorAll("li"))) {
			const rawText = listItem.textContent?.replace(/\s+/g, " ").trim() ?? "";
			if (!rawText) {
				continue;
			}

			const titleMatch = rawText.match(/^title:\s*(.+)$/i);
			if (titleMatch) {
				subtitle.textContent = titleMatch[1].trim();
				continue;
			}

			const item = document.createElement("span");
			item.className = "resume-header-item";

			const label = this.getHeaderLabel(rawText);
			const value = this.getHeaderValue(rawText);
			const hideLabel = /^(phone|location)$/i.test(label);
			const anchor = listItem.querySelector("a");

			if (anchor) {
				const link = document.createElement("a");
				link.href = anchor.getAttribute("href") ?? anchor.href;
				link.textContent = label;
				item.appendChild(link);
			} else {
				if (!hideLabel) {
					item.appendChild(this.createHeaderLabel(label));
				}
				item.appendChild(document.createTextNode(value));
			}

			contactItems.push(item);
		}

		for (const [index, item] of contactItems.entries()) {
			if (index > 0) {
				const separator = document.createElement("span");
				separator.className = "resume-header-separator";
				separator.setAttribute("aria-hidden", "true");
				separator.textContent = "•";
				contactRow.appendChild(separator);
			}

			contactRow.appendChild(item);
		}

		headerBlock.appendChild(heading);
		if (subtitle.textContent) {
			headerBlock.appendChild(subtitle);
		}
		headerBlock.appendChild(contactRow);

		list.replaceWith(headerBlock);
	}

	private createHeaderLabel(label: string): HTMLSpanElement {
		const span = document.createElement("span");
		span.className = "resume-header-label";
		span.textContent = `${label}: `;
		return span;
	}

	private getHeaderLabel(rawText: string): string {
		const match = rawText.match(/^([^:]+):\s*(.*)$/);
		if (match) {
			return match[1].trim();
		}

		return "Link";
	}

	private getHeaderValue(rawText: string): string {
		const match = rawText.match(/^([^:]+):\s*(.*)$/);
		if (match) {
			return match[2].trim();
		}

		return rawText;
	}

	normalizeSplitHeadings(container: HTMLElement): void {
		const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");

		for (const heading of Array.from(headings)) {
			if (heading.classList.contains("resume-header-block")) {
				continue;
			}

			const rawText = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
			if (!rawText.includes("|")) {
				continue;
			}

			const parts = rawText.split("|").map((part) => part.trim()).filter(Boolean);
			if (parts.length < 2) {
				continue;
			}

			const leftSide = parts[0];
			const rightSide = parts.slice(1).join(" |");

			heading.textContent = "";
			heading.classList.add("resume-split-heading");

			const leftSpan = document.createElement("span");
			leftSpan.className = "resume-split-heading-left";
			leftSpan.textContent = leftSide;

			const rightSpan = document.createElement("span");
			rightSpan.className = "resume-split-heading-right";
			rightSpan.textContent = rightSide;

			heading.append(leftSpan, rightSpan);
		}
	}

	/** Embeds render asynchronously; wait (max ~3s) until each has content. */
	async waitForEmbeds(container: HTMLElement, timeoutMs = 3000): Promise<void> {
		const isPending = (embed: Element) =>
			!embed.querySelector(".markdown-embed-content h1, .markdown-embed-content h2, .markdown-embed-content h3, .markdown-embed-content h4, .markdown-embed-content h5, .markdown-embed-content h6, .markdown-embed-content p, .markdown-embed-content ul, .markdown-embed-content ol");
		const start = Date.now();

		while (Date.now() - start < timeoutMs) {
			const embeds = Array.from(container.querySelectorAll(".internal-embed.markdown-embed, .internal-embed[src*='#']"));
			if (!embeds.some(isPending)) {
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
	}

	/**
	 * Unwraps embeds and Obsidian's wrapper divs so every block (heading, list,
	 * paragraph...) becomes a flat sibling. Page-break grouping needs this:
	 * without it, an embedded section is one opaque box after its h2.
	 */
	flattenBlocks(root: HTMLElement): HTMLElement[] {
		const leafSelector = "h1, h2, h3, h4, h5, h6, ul, ol, p, blockquote, hr, table, pre, img, .callout, .pdf-page-break";
		const alwaysLeafSelector = "ul, ol, table, blockquote, pre, .callout";
		const skipSelector = [
			".markdown-embed-link",
			".embed-title",
			".markdown-embed-title",
			".markdown-preview-pusher",
			".mod-header",
			".mod-footer",
			".frontmatter",
			".frontmatter-container",
			".metadata-container",
			".embedded-backlinks"
		].join(", ");
		const embedSelector = ".internal-embed, .markdown-embed";
		const blocks: HTMLElement[] = [];

		const walk = (parent: Element) => {
			for (const child of Array.from(parent.children)) {
				if (!(child instanceof HTMLElement) || child.matches(skipSelector)) {
					continue;
				}

				if (/^H[1-6]$/.test(child.tagName) && !child.textContent?.trim()) {
					continue; // e.g. "# %%General%%" variant headings inside embeds
				}

				const containsEmbed = child.matches(embedSelector) || child.querySelector(embedSelector) !== null;

				if (child.matches(alwaysLeafSelector) || (child.matches(leafSelector) && !containsEmbed)) {
					blocks.push(child);
					continue;
				}

				if (!child.querySelector(leafSelector)) {
					if (child.textContent?.trim()) {
						blocks.push(child);
					}
					continue;
				}

				walk(child);
			}
		};

		walk(root);
		return blocks;
	}

	/**
	 * Wraps content into print groups:
	 * - .resume-entry = a run of headings (h3/h4/h5...) + the content under them
	 * - .resume-keep  = an h2 + its first entry, so section titles like
	 *   "EDUCATION" are never left alone at the bottom of a page
	 * Both are break-inside: avoid, so the browser moves them to the next page
	 * whole instead of splitting them.
	 */
	groupForPrint(container: HTMLElement): void {
		const fragment = document.createDocumentFragment();
		let section: HTMLElement | null = null;
		let keep: HTMLElement | null = null;
		let keepOpen = false;
		let group: HTMLElement | null = null;

		const isHeading = (el: Element | null) => !!el && /^H[1-6]$/.test(el.tagName);

		const newGroup = (): HTMLElement => {
			const entry = document.createElement("div");
			entry.className = "resume-entry";

			if (keep && keepOpen) {
				keep.appendChild(entry);
				keepOpen = false;
			} else {
				(section ?? fragment).appendChild(entry);
			}

			return entry;
		};

		for (const block of Array.from(container.children) as HTMLElement[]) {
			if (block.tagName === "H1" || block.matches(".resume-header-block, .pdf-page-break")) {
				section = null;
				keep = null;
				keepOpen = false;
				group = null;
				fragment.appendChild(block);
				continue;
			}

			if (block.tagName === "H2") {
				section = document.createElement("section");
				section.className = "resume-section";
				keep = document.createElement("div");
				keep.className = "resume-keep";
				keep.appendChild(block);
				section.appendChild(keep);
				fragment.appendChild(section);
				keepOpen = true;
				group = null;
				continue;
			}

			if (isHeading(block)) {
				if (!group || !isHeading(group.lastElementChild)) {
					group = newGroup();
				}
				group.appendChild(block);
				continue;
			}

			if (!group) {
				group = newGroup();
			}
			group.appendChild(block);
		}

		container.replaceChildren(fragment);
	}

	escapeHtml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}

/**
 * Lays the preview document out onto real A4 sheets. Called by the preview modal on the
 * iframe's document (from Obsidian's side, so no script runs inside the preview).
 * Units are the print groups made by groupForPrint (header, h2 + first entry, entries).
 * A unit that doesn't fit on the current sheet starts a new one, a unit taller than a
 * whole page is split into its children, and <break> markers force a new sheet.
 * Printing uses the same sheets, so the PDF matches the preview page for page.
 */
function paginateDocument(doc: Document): number {
	const page = doc.querySelector(".page");
	const body = page?.querySelector(".resume-body") as HTMLElement | null;
	if (!page || !body || doc.querySelector(".sheet")) return doc.querySelectorAll(".sheet").length;

	const probe = doc.createElement("div");
	probe.style.cssText = "position:absolute;visibility:hidden;height:269mm;width:182mm";
	doc.body.appendChild(probe);
	const maxHeight = probe.getBoundingClientRect().height;
	const width = probe.getBoundingClientRect().width;
	probe.remove();

	const units: Element[] = [];
	for (const el of Array.from(body.children)) {
		if (el.matches("section.resume-section")) units.push(...Array.from(el.children));
		else units.push(el);
	}

	const sheets: HTMLElement[] = [];
	let current: HTMLElement | null = null;
	const newSheet = (): HTMLElement => {
		const sheet = doc.createElement("div");
		sheet.className = "sheet";
		const inner = doc.createElement("div");
		inner.className = body.className;
		inner.style.width = `${width}px`;
		sheet.appendChild(inner);
		doc.body.appendChild(sheet);
		sheets.push(sheet);
		current = inner;
		return inner;
	};
	const fits = (box: HTMLElement) => box.scrollHeight <= maxHeight + 0.5;
	const place = (unit: Element): void => {
		if (unit.matches(".pdf-page-break")) {
			if (current && current.children.length) newSheet();
			return;
		}
		let box = current ?? newSheet();
		box.appendChild(unit);
		if (fits(box)) return;
		unit.remove();
		if (box.children.length) {
			box = newSheet();
			box.appendChild(unit);
			if (fits(box)) return;
			unit.remove();
		}
		const kids = Array.from(unit.children);
		if (kids.length > 1) kids.forEach(place);
		else box.appendChild(unit); // a single block taller than a page: let it run over
	};

	units.forEach(place);
	page.remove();

	sheets.forEach((sheet, i) => {
		const label = doc.createElement("div");
		label.className = "sheet-label";
		label.textContent = `Page ${i + 1} of ${sheets.length}`;
		sheet.before(label);
	});
	return sheets.length;
}

class ResumePreviewModal extends Modal {
	private readonly previewHtml: string;
	private previewFrame: HTMLIFrameElement | null = null;

	private readonly fileName: string;

	constructor(app: Plugin["app"], previewHtml: string, fileName: string) {
		super(app);
		this.previewHtml = previewHtml;
		this.fileName = fileName;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("resume-preview-modal");
		contentEl.style.display = "flex";
		contentEl.style.flexDirection = "column";
		contentEl.style.height = "100%";
		this.titleEl.setText("PDF Preview");
		this.modalEl.style.width = "min(96vw, 1100px)";
		this.modalEl.style.maxHeight = "94vh";

		const toolbar = contentEl.createDiv({ cls: "resume-preview-toolbar" });
		const previewButton = toolbar.createEl("button", { text: "Print" });
		previewButton.type = "button";
		previewButton.addEventListener("click", () => this.printPreview());

		const closeButton = toolbar.createEl("button", { text: "Close" });
		closeButton.type = "button";
		closeButton.addEventListener("click", () => this.close());

		const frameWrap = contentEl.createDiv({ cls: "resume-preview-frame-wrap" });
		this.previewFrame = frameWrap.createEl("iframe", {
			attr: {
				title: "PDF preview",
				part: "preview-frame"
			}
		});
		const frame = this.previewFrame;
		frame.addEventListener("load", async () => {
			const doc = frame.contentDocument;
			if (!doc) return;
			await Promise.all(Array.from(doc.images).map((img) =>
				img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })));
			await doc.fonts?.ready;
			const pages = paginateDocument(doc);
			this.titleEl.setText(`PDF Preview (${pages} page${pages === 1 ? "" : "s"})`);
		}, { once: true });
		frame.srcdoc = this.previewHtml;
		window.setTimeout(() => this.resizePreviewFrame(), 0);
	}

	onClose(): void {
		this.previewFrame = null;
		this.contentEl.empty();
	}

	private resizePreviewFrame(): void {
		const frameWrap = this.contentEl.querySelector(".resume-preview-frame-wrap") as HTMLElement | null;

		if (!frameWrap) {
			return;
		}

		const availableHeight = Math.max(window.innerHeight * 0.94 - 110, 300);
		const availableWidth = Math.max(window.innerWidth * 0.96 - 48, 300);
		const a4WidthFromHeight = availableHeight * (210 / 297);
		const a4HeightFromWidth = availableWidth * (297 / 210);
		const targetWidth = Math.min(a4WidthFromHeight, availableWidth);
		const targetHeight = Math.min(a4HeightFromWidth, availableHeight);

		frameWrap.style.width = `${Math.floor(targetWidth)}px`;
		frameWrap.style.height = `${Math.floor(targetHeight)}px`;
	}

	private printPreview(): void {
		if (!this.previewFrame?.contentWindow) {
			new Notice("Preview is not ready yet.");
			return;
		}

		// The save dialog suggests the top window's title as the file name, so show the
		// note's name there while printing, then put Obsidian's title back.
		const previousTitle = document.title;
		const restore = () => { document.title = previousTitle; };
		document.title = this.fileName;
		this.previewFrame.contentWindow.addEventListener("afterprint", restore, { once: true });
		this.previewFrame.contentWindow.focus();
		this.previewFrame.contentWindow.print();
		window.setTimeout(restore, 1000);
	}
}