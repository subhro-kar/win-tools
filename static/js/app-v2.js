/* ── WinTools Dashboard — Frontend Logic ────────────────────────── */

const API = "/api";
let allApps = [];
let selectedApps = new Set();
let catalogColors = {};

// ── Category CSS class mapping (for Installed/Categories tabs) ────

const CAT_CLASSES = {
    "Drivers": "cat-drivers",
    "IDE & Editors": "cat-ide",
    "Runtimes & SDKs": "cat-runtimes",
    "Virtualization": "cat-virtualization",
    "Databases": "cat-databases",
    "Version Control": "cat-vcs",
    "Browsers": "cat-browsers",
    "Text Editors": "cat-editors",
    "Archivers": "cat-archivers",
    "Media": "cat-media",
    "Office & Notes": "cat-office",
    "Communication": "cat-comm",
    "Gaming": "cat-gaming",
    "Network & VPN": "cat-network",
    "Security": "cat-security",
    "System Utilities": "cat-utilities",
    "Hardware Monitoring": "cat-hardware",
    "Dev Tools": "cat-devtools",
    ".NET Framework": "cat-netframework",
    "VC++ Redistributables": "cat-vcredist",
    "OEM Software": "cat-oem",
    "Network Tools": "cat-nettools",
    "Graphics & Design": "cat-graphics",
    "Cloud Storage": "cat-cloud",
    "Peripherals": "cat-peripherals",
    "Microsoft System": "cat-mssystem",
    "Windows Apps": "cat-netframework",
    "Security & VPN": "cat-network",
    "Other": "cat-other",
};

// ── Safe DOM helpers ────────────────────────────────────────────

function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
        if (key === "className") {
            el.className = val;
        } else if (key === "dataset") {
            Object.assign(el.dataset, val);
        } else if (key.startsWith("on")) {
            el.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
            el.setAttribute(key, val);
        }
    }
    for (const child of children) {
        if (typeof child === "string") {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }
    return el;
}

function clearAndAppend(parent, child) {
    parent.textContent = "";
    parent.appendChild(child);
}

function showLoading(parent, message = "Loading...") {
    const div = createElement("div", { className: "loading" });
    div.textContent = message;
    parent.textContent = "";
    parent.appendChild(div);
}

// ── Tab Navigation ──────────────────────────────────────────────

document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        switchTab(target);
    });
});

function switchTab(tabId) {
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
    document.getElementById(`tab-${tabId}`).classList.add("active");

    if (tabId === "system") loadSystemInfo();
    if (tabId === "categories") loadCategories();
    if (tabId === "export") loadExport();
    if (tabId === "sync") loadSync();
    if (tabId === "tweaks") {
        if (tweaksData) {
            renderTweaks(tweaksData, tweaksIsElevated);
        } else {
            loadTweaks();
        }
    }
    if (tabId === "winoptions") {
        if (winoptionsData) {
            renderWinOptions(winoptionsData, winoptionsIsElevated);
        } else {
            loadWinOptions();
        }
    }
    if (tabId === "privacy") {
        if (privacyData) {
            renderPrivacy(privacyData, privacyIsElevated);
        } else {
            loadPrivacy();
        }
    }
    if (tabId === "quicksetup") {
        if (quicksetupData) {
            renderQuickSetup(quicksetupData, quicksetupIsElevated);
        } else {
            loadQuickSetup();
        }
    }
}

// ── Toast Notifications ─────────────────────────────────────────

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = createElement("div", { className: `toast ${type}` }, [message]);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Format Helpers ──────────────────────────────────────────────

function formatSize(mb) {
    if (!mb || mb === 0) return "—";
    if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
}

function getCatClass(category) {
    return CAT_CLASSES[category] || "cat-other";
}

function getArchClass(arch) {
    if (arch === "x64") return "arch-x64";
    if (arch === "x86") return "arch-x86";
    if (arch === "UWP") return "arch-User";
    return "arch-User";
}

// ── Generate letter-based icon for app card ─────────────────────

function getInitials(name) {
    // Get 1-2 letter initials from app name
    const words = name.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(w => w.length > 0);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function lazyLoadIcons() {
    const icons = document.querySelectorAll(".lazy-icon");
    if (!icons.length) return;

    // Only load 6 favicons at a time to avoid overwhelming the network
    let loading = 0;
    const MAX_CONCURRENT = 6;

    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                observer.unobserve(entry.target);
                loadIconWhenReady(entry.target);
            }
        }
    }, { rootMargin: "200px" });

    function loadIconWhenReady(el) {
        const tryLoad = () => {
            if (loading >= MAX_CONCURRENT) {
                setTimeout(tryLoad, 100);
                return;
            }
            loading++;
            const url = el.dataset.faviconUrl;
            const appName = el.dataset.appName;
            const img = new Image();
            img.onload = () => {
                el.textContent = "";
                el.style.color = "";
                img.alt = appName;
                el.appendChild(img);
                loading--;
            };
            img.onerror = () => {
                // Keep the letter fallback that's already shown
                loading--;
            };
            img.src = url;
        };
        tryLoad();
    }

    for (const icon of icons) {
        observer.observe(icon);
    }
}

function getCategoryColor(category) {
    return catalogColors[category] || "#58a6ff";
}

// ── Install Catalog (Icon Grid) ─────────────────────────────────

let catalogData = null;

async function loadCatalog() {
    const el = document.getElementById("install-catalog");
    showLoading(el, "Loading software catalog...");

    try {
        const res = await fetch(`${API}/catalog`);
        const data = await res.json();
        catalogData = data;
        catalogColors = data.colors || {};

        let installedCount = 0;
        el.textContent = "";

        for (const [cat, items] of Object.entries(data.categories)) {
            const installedInCat = items.filter(i => i.installed).length;
            installedCount += installedInCat;

            // Section with category heading
            const section = createElement("div", { className: "install-grid-section" });

            const heading = createElement("h2", {}, [
                cat,
                createElement("span", { className: "cat-count" }, [`${items.length} apps`]),
            ]);
            if (installedInCat > 0) {
                heading.appendChild(createElement("span", { className: "installed-count" }, [` · ${installedInCat} installed`]));
            }
            section.appendChild(heading);

            // Grid of app cards
            const grid = createElement("div", { className: "install-grid" });

            for (const item of items) {
                const card = createAppCard(item);
                grid.appendChild(card);
            }

            section.appendChild(grid);
            el.appendChild(section);
        }

        document.getElementById("stat-catalog-total").textContent = data.total;
        document.getElementById("stat-catalog-installed").textContent = installedCount;
        document.getElementById("stat-catalog-remaining").textContent = data.total - installedCount;

        // Lazy-load favicons using IntersectionObserver — only load when visible
        lazyLoadIcons();

    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function createAppCard(item) {
    const card = createElement("div", { className: `app-card${item.installed ? " installed" : ""}${!item.id ? " manual" : ""}` });

    if (item.installed) {
        card.dataset.tooltip = "Already installed";
    } else if (!item.id) {
        card.dataset.tooltip = "Manual install required";
    }

    // Icon container — lazy load favicons to avoid hundreds of simultaneous requests
    const iconContainer = createElement("div", { className: "app-icon" });

    if (item.icon && item.icon !== "") {
        // Custom local icon (future use)
        const img = createElement("img", { src: item.icon, alt: item.name, loading: "lazy" });
        img.onerror = function() {
            this.style.display = "none";
            this.parentNode.textContent = getInitials(item.name);
            this.parentNode.style.color = getCategoryColor(item.category);
        };
        iconContainer.appendChild(img);
    } else if (item.link && item.link !== "") {
        // Show letter placeholder immediately, load favicon lazily
        iconContainer.textContent = getInitials(item.name);
        iconContainer.style.color = getCategoryColor(item.category);
        iconContainer.dataset.faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(item.link)}`;
        iconContainer.dataset.appName = item.name;
        iconContainer.dataset.category = item.category;
        iconContainer.classList.add("lazy-icon");
    } else {
        // No link — use letter placeholder with category color
        iconContainer.textContent = getInitials(item.name);
        iconContainer.style.color = getCategoryColor(item.category);
    }

    // Installed badge (green checkmark)
    if (item.installed) {
        const badge = createElement("div", { className: "installed-badge" }, ["✓"]);
        iconContainer.appendChild(badge);
    }

    // App name (with FOSS indicator if open source)
    const nameEl = createElement("div", { className: "app-name" });
    nameEl.title = item.name;
    const nameText = document.createTextNode(item.name);
    nameEl.appendChild(nameText);
    if (item.foss) {
        const fossDot = createElement("span", { className: "foss-dot" }, [" ●"]);
        nameEl.appendChild(fossDot);
    }

    card.append(iconContainer, nameEl);

    // Click handler for install
    if (!item.installed && item.id) {
        card.addEventListener("click", () => installPackage(item.id, card));
    }

    return card;
}

async function installPackage(wingetId, cardEl) {
    // Prevent double-clicks
    if (cardEl.classList.contains("installing")) return;

    cardEl.classList.remove("installed", "installed-success", "failed");
    cardEl.classList.add("installing");
    cardEl.dataset.tooltip = "Installing...";

    try {
        const res = await fetch(`${API}/install/${encodeURIComponent(wingetId)}`, { method: "POST" });
        const data = await res.json();

        if (!data.success && data.error !== "Already installing") {
            cardEl.classList.remove("installing");
            cardEl.classList.add("failed");
            cardEl.dataset.tooltip = `Install failed: ${data.error}`;
            showToast(`Install failed: ${data.error}`, "error");
            // Reset after 5 seconds so user can retry
            setTimeout(() => {
                cardEl.classList.remove("failed");
                cardEl.dataset.tooltip = "";
            }, 5000);
            return;
        }

        // Poll for status
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`${API}/install-status/${encodeURIComponent(wingetId)}`);
                const status = await statusRes.json();

                if (status.status === "installed") {
                    clearInterval(pollInterval);
                    cardEl.classList.remove("installing");
                    cardEl.classList.add("installed-success");
                    cardEl.dataset.tooltip = "Installed!";

                    // After 2 seconds, switch to permanent installed state
                    setTimeout(() => {
                        cardEl.classList.remove("installed-success");
                        cardEl.classList.add("installed");
                        cardEl.dataset.tooltip = "Already installed";
                        // Add checkmark badge
                        const iconEl = cardEl.querySelector(".app-icon");
                        if (iconEl && !iconEl.querySelector(".installed-badge")) {
                            iconEl.appendChild(createElement("div", { className: "installed-badge" }, ["✓"]));
                        }
                        // Remove click handler by replacing card
                        const newCard = cardEl.cloneNode(true);
                        cardEl.parentNode.replaceChild(newCard, cardEl);
                    }, 2000);

                    showToast(`${wingetId} installed successfully!`, "success");
                } else if (status.status === "failed") {
                    clearInterval(pollInterval);
                    cardEl.classList.remove("installing");
                    cardEl.classList.add("failed");
                    cardEl.dataset.tooltip = `Failed: ${status.error || "Unknown error"}`;
                    showToast(`Install failed: ${status.error || "Unknown error"}`, "error");
                    setTimeout(() => {
                        cardEl.classList.remove("failed");
                        cardEl.dataset.tooltip = "";
                    }, 5000);
                } else {
                    cardEl.dataset.tooltip = `Installing... ${status.percent || 0}%`;
                }
            } catch (e) {
                // Keep polling
            }
        }, 2000);

    } catch (err) {
        cardEl.classList.remove("installing");
        cardEl.classList.add("failed");
        cardEl.dataset.tooltip = `Error: ${err.message}`;
        showToast(`Error: ${err.message}`, "error");
        setTimeout(() => {
            cardEl.classList.remove("failed");
            cardEl.dataset.tooltip = "";
        }, 5000);
    }
}

// ── Load Apps (for Export/Categories/System tabs) ────────────────────

async function loadApps() {
    try {
        const res = await fetch(`${API}/apps`);
        const data = await res.json();
        allApps = data.applications || [];
        selectedApps.clear();
    } catch (err) {
        // Silent - only needed for export/categories
    }
}

// ── System Info ─────────────────────────────────────────────────

async function loadSystemInfo() {
    const el = document.getElementById("system-info");
    const diskEl = document.getElementById("disk-info");
    showLoading(el, "Loading...");
    diskEl.textContent = "";

    try {
        const res = await fetch(`${API}/system`);
        const sys = await res.json();

        const items = [
            { label: "Computer Name", value: sys.ComputerName || "—" },
            { label: "Operating System", value: sys.OS || "—" },
            { label: "OS Version", value: `${sys.OSVersion || "?"} (Build ${sys.OSBuild || "?"})` },
            { label: "CPU", value: sys.CPU || "—" },
            { label: "GPU", value: sys.GPU || "—" },
            { label: "Total RAM", value: sys.TotalRAM_MB ? `${sys.TotalRAM_MB.toLocaleString()} MB` : "—" },
        ];

        const grid = createElement("div", { className: "system-grid" });
        for (const item of items) {
            const sysItem = createElement("div", { className: "sys-item" });
            sysItem.appendChild(createElement("span", { className: "label" }, [item.label]));
            sysItem.appendChild(createElement("span", { className: "value" }, [item.value]));
            grid.appendChild(sysItem);
        }
        el.textContent = "";
        el.appendChild(grid);

        if (sys.Disks) {
            diskEl.textContent = "";
            for (const disk of sys.Disks) {
                const pct = disk.UsedPct || 0;
                const barColor = pct > 90 ? "var(--red)" : pct > 70 ? "var(--orange)" : "var(--green)";
                const card = createElement("div", { className: "disk-card" });
                const h3 = createElement("h3", {}, [`Drive ${disk.Drive}`]);
                const bar = createElement("div", { className: "disk-bar" });
                const barFill = createElement("div", { className: "disk-bar-fill" });
                barFill.style.width = `${pct}%`;
                barFill.style.background = barColor;
                bar.appendChild(barFill);
                const stats = createElement("div", { className: "disk-stats" });
                const makeStat = (val, lbl) => {
                    const s = createElement("div", { className: "disk-stat" });
                    s.appendChild(createElement("div", { className: "val" }, [val]));
                    s.appendChild(createElement("div", { className: "lbl" }, [lbl]));
                    return s;
                };
                stats.append(makeStat(`${disk.SizeGB} GB`, "Total"), makeStat(`${disk.UsedGB} GB`, "Used"), makeStat(`${disk.FreeGB} GB`, "Free"));
                card.append(h3, bar, stats);
                diskEl.appendChild(card);
            }
        }
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

// ── Categories ──────────────────────────────────────────────────

async function loadCategories() {
    const el = document.getElementById("category-grid");
    showLoading(el, "Loading...");

    try {
        const res = await fetch(`${API}/categories`);
        const data = await res.json();
        const maxSize = Math.max(...data.categories.map(c => c.TotalSizeMB), 1);

        el.textContent = "";
        for (const cat of data.categories) {
            const pct = cat.TotalSizeMB ? (cat.TotalSizeMB / maxSize * 100) : 0;
            const catName = cat.Name || "Other";

            const card = createElement("div", { className: "category-card" });
            card.addEventListener("click", () => {
                // Switch to install tab and highlight this category (optional)
            });

            const header = createElement("div", { className: "cat-header" });
            const nameSpan = createElement("span", { className: `cat-name ${getCatClass(catName)}` });
            nameSpan.style.padding = "2px 8px";
            nameSpan.style.borderRadius = "10px";
            nameSpan.textContent = catName;
            const countSpan = createElement("span", { className: "cat-count" }, [`${cat.Count} apps`]);
            header.append(nameSpan, countSpan);

            const sizeDiv = createElement("div", { className: "cat-size" }, [formatSize(cat.TotalSizeMB)]);
            const bar = createElement("div", { className: "category-bar" });
            const barFill = createElement("div", { className: "category-bar-fill" });
            barFill.style.width = `${pct}%`;
            bar.appendChild(barFill);

            card.append(header, sizeDiv, bar);
            el.appendChild(card);
        }
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

// ── Export ──────────────────────────────────────────────────────

async function loadExport() {
    const el = document.getElementById("export-content");
    showLoading(el, "Loading...");

    try {
        const res = await fetch(`${API}/export`);
        const data = await res.json();

        el.textContent = "";

        const summarySection = createElement("div", { className: "export-section" });
        const h3 = createElement("h3", {}, ["Export Summary"]);
        const desc = createElement("p", { style: "color:var(--text-secondary);margin-bottom:12px;" });
        desc.textContent = `${data.total} applications across ${Object.keys(data.grouped).length} categories. Click "Export All" to generate a winget reinstall script for your new SSD.`;
        const actions = createElement("div", { className: "export-actions" });
        const btnAll = createElement("button", { className: "btn btn-green" }, ["Export All as Install Script"]);
        btnAll.addEventListener("click", exportAll);
        actions.appendChild(btnAll);
        summarySection.append(h3, desc, actions);
        el.appendChild(summarySection);

        const sortedGroups = Object.entries(data.grouped).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [cat, apps] of sortedGroups) {
            const section = createElement("div", { className: "export-section" });
            const catH3 = createElement("h3", {}, [`${cat} (${apps.length})`]);
            const group = createElement("div", { className: "export-group" });

            for (const a of apps) {
                const appDiv = createElement("div", { className: "export-app" });
                appDiv.appendChild(createElement("div", { className: "check" }));
                appDiv.appendChild(createElement("span", {}, [a.Name || ""]));
                const verSpan = createElement("span", { style: "color:var(--text-muted);font-size:11px;margin-left:auto;" }, [a.Version || ""]);
                appDiv.appendChild(verSpan);
                group.appendChild(appDiv);
            }

            section.append(catH3, group);
            el.appendChild(section);
        }
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function exportAll() {
    const names = allApps.map(a => a.Name);
    generateInstallScript(names);
}

function generateInstallScript(appNames) {
    const apps = allApps.filter(a => appNames.includes(a.Name));

    let script = `# WinTools - Application Reinstall Script\n`;
    script += `# Generated: ${new Date().toISOString()}\n`;
    script += `# Total applications: ${apps.length}\n\n`;
    script += `# Run as Administrator\n`;
    script += `# This script will reinstall your applications on the new SSD\n\n`;

    const grouped = {};
    for (const app of apps) {
        const cat = app.Category || "Other";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(app);
    }

    for (const [cat, catApps] of Object.entries(grouped).sort()) {
        script += `\n# ── ${cat} ──\n`;
        for (const app of catApps) {
            const wingetId = guessWingetId(app);
            if (wingetId) {
                script += `winget install --id ${wingetId} --accept-package-agreements --accept-source-agreements\n`;
            } else {
                script += `# TODO: Manual install - ${app.Name} (${app.Publisher || "Unknown"})\n`;
            }
        }
    }

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reinstall-apps.ps1';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${apps.length} applications!`, "success");
}

function guessWingetId(app) {
    const name = (app.Name || "").toLowerCase();
    const mappings = {
        "7-zip": "7zip.7zip",
        "brave": "Brave.Brave",
        "notepad++": "Notepad++.Notepad++",
        "docker desktop": "Docker.DockerDesktop",
        "git": "Git.Git",
        "github cli": "GitHub.cli",
        "github desktop": "GitHub.GitHubDesktop",
        "github copilot": "GitHub.GitHubCopilot",
        "visual studio code": "Microsoft.VisualStudioCode",
        "vs code": "Microsoft.VisualStudioCode",
        "node.js": "OpenJS.NodeJS.LTS",
        "python": "Python.Python.3.12",
        "postman": "Postman.Postman",
        "powertoys": "Microsoft.PowerToys",
        "putty": "PuTTY.PuTTY",
        "vlc": "VideoLAN.VLC",
        "crystaldiskinfo": "CrystalDewWorld.CrystalDiskInfo",
        "crystaldiskmark": "CrystalDewWorld.CrystalDiskMark",
        "cpu-z": "CPUID.CPU-Z",
        "hwmonitor": "CPUID.HWMonitor",
        "nvm for windows": "CoreyButler.NVMforWindows",
        "imagemagick": "ImageMagick.ImageMagick",
        "cloudflared": "Cloudflare.cloudflared",
        "ffmpeg": "Gyan.FFmpeg",
        "notion": "Notion.Notion",
        "discord": "Discord.Discord",
        "telegram": "Telegram.TelegramDesktop",
        "obsidian": "Obsidian.Obsidian",
        "obs studio": "OBSProject.OBSStudio",
        "steam": "Valve.Steam",
        "epic games": "EpicGames.EpicGamesLauncher",
        "spotify": "Spotify.Spotify",
        "slack": "SlackTechnologies.Slack",
        "zoom": "Zoom.Zoom",
        "windows terminal": "Microsoft.WindowsTerminal",
        "wireshark": "WiresharkFoundation.Wireshark",
        "docker": "Docker.DockerDesktop",
    };
    for (const [key, id] of Object.entries(mappings)) {
        if (name.includes(key)) return id;
    }
    return null;
}

// ── Rescan ──────────────────────────────────────────────────────

document.getElementById("btn-rescan").addEventListener("click", async () => {
    const btn = document.getElementById("btn-rescan");
    btn.textContent = "⟳ Scanning...";
    btn.disabled = true;
    showToast("Rescanning installed applications...", "info");

    try {
        const res = await fetch(`${API}/scan`, { method: "POST" });
        const data = await res.json();
        if (data.success) {
            showToast("Scan complete!", "success");
            await loadApps();
            await loadCatalog();
        } else {
            showToast(`Scan failed: ${data.error}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.textContent = "⟳ Rescan";
    btn.disabled = false;
});

// ── Sync Tab (Secrets Backup & Restore) ────────────────────────────

let syncMode = "backup";
let syncData = null;
let restoreManifest = null;
let restoreKey = null;

function setSyncMode(mode) {
    syncMode = mode;
    document.getElementById("sync-backup").style.display = mode === "backup" ? "" : "none";
    document.getElementById("sync-restore").style.display = mode === "restore" ? "" : "none";
    document.getElementById("sync-mode-backup").classList.toggle("active", mode === "backup");
    document.getElementById("sync-mode-backup").classList.toggle("btn-accent", mode === "backup");
    document.getElementById("sync-mode-restore").classList.toggle("active", mode === "restore");
    document.getElementById("sync-mode-restore").classList.toggle("btn-accent", mode === "restore");
    // Reset non-active button style
    if (mode === "backup") {
        document.getElementById("sync-mode-restore").className = "btn";
    } else {
        document.getElementById("sync-mode-backup").className = "btn";
    }
}

async function loadSync() {
    const checklist = document.getElementById("sync-checklist");
    showLoading(checklist, "Scanning your system...");

    try {
        const res = await fetch(`${API}/migrate/scan`);
        syncData = await res.json();

        if (syncData.error) {
            checklist.textContent = "";
            checklist.appendChild(createElement("div", { className: "loading" }, [`Error: ${syncData.error}`]));
            return;
        }

        checklist.textContent = "";
        const items = [
            {
                key: "ssh",
                label: "SSH Config (public keys only)",
                found: syncData.ssh?.found,
                detail: syncData.ssh?.found
                    ? `${syncData.ssh.keyCount} key(s) in ${syncData.ssh.dir} (public keys & config only — private keys excluded)`
                    : "No SSH keys found",
                count: syncData.ssh?.keyCount || 0,
                files: (syncData.ssh?.files || []).map(f => f.Name).filter(n => !n.endsWith(".old")),
            },
            {
                key: "git",
                label: "Git Config",
                found: syncData.git?.found,
                detail: syncData.git?.found
                    ? `Found: ${syncData.git.path}`
                    : "No .gitconfig found",
                files: syncData.git?.found ? [".gitconfig"] : [],
            },
            {
                key: "envVars",
                label: "Environment Variables",
                found: syncData.envVars?.found,
                detail: syncData.envVars?.found
                    ? `${syncData.envVars.count} user environment variables`
                    : "No user env vars found",
                count: syncData.envVars?.count || 0,
                files: syncData.envVars?.found ? Object.keys(syncData.envVars.vars || {}) : [],
            },
            {
                key: "psProfile",
                label: "PowerShell 5 Profile",
                found: syncData.psProfile?.found,
                detail: syncData.psProfile?.found
                    ? `Found: ${syncData.psProfile.path}`
                    : "No PowerShell 5 profile found",
                files: syncData.psProfile?.found ? ["Microsoft.PowerShell_profile.ps1"] : [],
            },
            {
                key: "ps7profile",
                label: "PowerShell 7 Profile",
                found: syncData.ps7profile?.found,
                detail: syncData.ps7profile?.found
                    ? `Found: ${syncData.ps7profile.path}`
                    : "No PowerShell 7 profile found",
                files: syncData.ps7profile?.found ? ["Microsoft.PowerShell7_profile.ps1"] : [],
            },
            {
                key: "gpg",
                label: "GPG Keys",
                found: syncData.gpg?.found,
                detail: syncData.gpg?.found
                    ? `${syncData.gpg.keyCount} secret key(s)`
                    : syncData.gpg?.available
                        ? "No GPG secret keys found"
                        : "GPG not installed",
                files: syncData.gpg?.found ? ["gpg-secret-keys.asc"] : [],
            },
            {
                key: "windowsTerminal",
                label: "Windows Terminal Settings",
                found: syncData.windowsTerminal?.found,
                detail: syncData.windowsTerminal?.found
                    ? `Found: ${syncData.windowsTerminal.path}`
                    : "Windows Terminal settings not found",
                files: syncData.windowsTerminal?.found ? ["settings.json"] : [],
            },
            {
                key: "claude",
                label: "Claude Code Config",
                found: syncData.claude?.found,
                detail: syncData.claude?.found
                    ? `${syncData.claude.skills} skill(s) + settings`
                    : "No Claude Code config found",
                count: syncData.claude?.skills || 0,
                files: syncData.claude?.found
                    ? ["settings.json", ...(syncData.claude.hasLocalSettings ? ["settings.local.json"] : []), ...(syncData.claude.skills ? [`${syncData.claude.skills} skills/`] : [])]
                    : [],
            },
            {
                key: "npm",
                label: "npm Global Packages",
                found: syncData.npm?.found,
                detail: syncData.npm?.found
                    ? `${syncData.npm.count} global package(s)`
                    : "No npm global packages found",
                count: syncData.npm?.count || 0,
                files: (syncData.npm?.packages || []).map(p => `${p.name}@${p.version}`),
            },
            {
                key: "copilot",
                label: "GitHub Copilot Config",
                found: syncData.copilot?.found,
                detail: syncData.copilot?.found
                    ? `${Object.keys(syncData.copilot.files || {}).length} config file(s)`
                    : "No GitHub Copilot config found",
                count: syncData.copilot?.files ? Object.keys(syncData.copilot.files).length : 0,
                files: Object.keys(syncData.copilot?.files || {}),
            },
        ];

        for (const item of items) {
            const label = createElement("label", { className: "sync-check-item" });
            const checkbox = createElement("input", { type: "checkbox", name: "sync-item", value: item.key });
            if (item.found) {
                checkbox.checked = true;
            } else {
                checkbox.disabled = true;
                label.style.opacity = "0.5";
            }

            const info = createElement("div", { className: "check-info" });
            info.appendChild(createElement("div", { className: "check-label" }, [item.label]));
            info.appendChild(createElement("div", { className: "check-detail" }, [item.detail]));

            const badge = createElement("span", { className: `check-badge${item.found ? "" : " missing"}` });
            badge.textContent = item.found
                ? (item.count ? `${item.count} found` : "Found")
                : "Not found";

            label.append(checkbox, info, badge);

            // Expandable file list
            if (item.files && item.files.length > 0) {
                const toggle = createElement("span", { className: "sync-file-toggle" }, ["▸"]);
                const fileList = createElement("div", { className: "sync-file-list" });
                for (const f of item.files) {
                    fileList.appendChild(createElement("div", { className: "sync-file-item" }, [f]));
                }
                fileList.style.display = "none";
                toggle.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const open = fileList.style.display !== "none";
                    fileList.style.display = open ? "none" : "block";
                    toggle.textContent = open ? "▸" : "▾";
                });
                label.appendChild(toggle);
                label.appendChild(fileList);
            }

            checklist.appendChild(label);
        }

    } catch (err) {
        checklist.textContent = "";
        checklist.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }

    // Restore saved R2 credentials from server (persists across restarts)
    try {
        const res = await fetch(`${API}/migrate/r2-credentials`);
        const saved = await res.json();
        if (saved.connected && saved.account_id && saved.access_key_id && saved.secret_access_key) {
            document.getElementById("r2-account-id").value = saved.account_id || "";
            document.getElementById("r2-access-key").value = saved.access_key_id || "";
            document.getElementById("r2-secret-key").value = saved.secret_access_key || "";
            document.getElementById("r2-bucket").value = saved.bucket_name || "wintools-backup";
            showR2Connected(saved.account_name || "", saved.bucket_name || "wintools-backup");
        }
    } catch (e) { /* credentials file not found or error — show setup form */ }
}

function getSyncCredentials() {
    const creds = {
        account_id: document.getElementById("r2-account-id").value.trim(),
        access_key_id: document.getElementById("r2-access-key").value.trim(),
        secret_access_key: document.getElementById("r2-secret-key").value.trim(),
        bucket_name: document.getElementById("r2-bucket").value.trim() || "wintools-backup",
    };
    // Include computer name from scan data for upload path
    if (syncData && syncData.computerName) {
        creds.computer_name = syncData.computerName;
    }
    return creds;
}

function getSyncSelectedItems() {
    const items = {};
    document.querySelectorAll("#sync-checklist input[name=sync-item]").forEach(cb => {
        items[cb.value] = cb.checked;
    });
    return items;
}

function toggleSyncGuide() {
    const guide = document.getElementById("sync-r2-guide");
    const toggle = document.querySelector(".sync-guide-toggle");
    const isOpen = guide.classList.toggle("open");
    toggle.textContent = isOpen ? "Hide setup guide ▴" : "Where do I get an API token? ▾";
}

async function quickConnect() {
    const apiToken = document.getElementById("cf-api-token").value.trim();
    const bucketName = document.getElementById("cf-bucket-name").value.trim() || "wintools-backup";
    const resultEl = document.getElementById("quick-connect-result");
    const btn = document.getElementById("btn-quick-connect");

    if (!apiToken) {
        resultEl.textContent = "✗ Please enter your Cloudflare API token";
        resultEl.className = "sync-status error";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Connecting...";
    resultEl.textContent = "Verifying token & configuring R2 (this may take a few seconds)...";
    resultEl.className = "sync-status pending";

    try {
        const res = await fetch(`${API}/migrate/r2-auto-setup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_token: apiToken, bucket_name: bucketName }),
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.success) {
            // Auto-fill the manual credential fields
            document.getElementById("r2-account-id").value = data.account_id || "";
            document.getElementById("r2-access-key").value = data.access_key_id || "";
            document.getElementById("r2-secret-key").value = data.secret_access_key || "";
            document.getElementById("r2-bucket").value = data.bucket_name || bucketName;

            // Persist credentials to server so they survive app restarts
            try {
                await fetch(`${API}/migrate/r2-credentials`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        account_id: data.account_id || "",
                        access_key_id: data.access_key_id || "",
                        secret_access_key: data.secret_access_key || "",
                        bucket_name: data.bucket_name || bucketName,
                        account_name: data.account_name || "",
                    }),
                });
            } catch (e) { /* save failed, still works in-memory */ }

            let msg = "✓ Connected!";
            if (data.account_name) msg += ` Account: ${data.account_name}`;
            if (data.bucket_created) msg += " Bucket created.";
            else msg += " Bucket already exists.";
            resultEl.textContent = msg;
            resultEl.className = "sync-status success";
            showToast("R2 configured! Bucket & credentials are ready.", "success");

            // Hide setup cards, show connected status
            showR2Connected(data.account_name, data.bucket_name);

            // Auto-test the connection
            setTimeout(() => testR2Connection(), 500);
        } else {
            const step = data.step || "";
            let msg = `✗ ${data.error || "Setup failed"}`;
            if (step === "list_buckets") {
                msg = "✗ R2 may not be enabled. Enable it in the Cloudflare dashboard first.";
            } else if (step === "create_bucket") {
                msg = `✗ Could not create bucket: ${data.error}`;
            } else if (step === "create_token") {
                msg = `✗ Could not create API token: ${data.error}. Your token may need "API Tokens: Edit" permission.`;
            }
            resultEl.textContent = msg;
            resultEl.className = "sync-status error";
        }
    } catch (err) {
        let msg = "✗ Connection failed";
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
            msg = "✗ Could not reach the server. Is WinTools running?";
        } else if (err.message.includes("timeout")) {
            msg = "✗ Request timed out. Cloudflare API may be slow — try again.";
        } else {
            msg = `✗ ${err.message}`;
        }
        resultEl.textContent = msg;
        resultEl.className = "sync-status error";
    }

    btn.disabled = false;
    btn.textContent = "⚡ Connect & Configure";
}

async function showR2Connected(accountName, bucketName) {
    // Hide Quick Connect and manual credential cards
    const quickConnect = document.querySelector(".sync-quickconnect");
    const manualCard = document.querySelector("#sync-backup .sync-card:nth-of-type(2)");
    if (quickConnect) quickConnect.style.display = "none";
    if (manualCard) manualCard.style.display = "none";

    // Change backup button to "Sync" and hide local-only button
    const btnBackup = document.getElementById("btn-backup-r2");
    if (btnBackup) btnBackup.textContent = "🔄 Sync to R2";
    const btnLocal = document.getElementById("btn-backup-local");
    if (btnLocal) btnLocal.style.display = "none";

    // Show or create connected status bar — insert at top of sync-backup
    let statusBar = document.getElementById("r2-connected-status");
    if (!statusBar) {
        statusBar = document.createElement("div");
        statusBar.id = "r2-connected-status";
        statusBar.className = "sync-card r2-connected-bar";
        const syncBackup = document.getElementById("sync-backup");
        if (syncBackup) {
            syncBackup.insertBefore(statusBar, syncBackup.firstChild);
        }
    }

    // Check for existing backups in R2
    let backupInfo = "";
    try {
        const creds = getSyncCredentials();
        const listRes = await fetch(`${API}/migrate/r2-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creds),
        });
        const listData = await listRes.json();
        if (listData.success && listData.backups && listData.backups.length > 0) {
            const latest = listData.backups[0];
            const date = latest.last_modified ? new Date(latest.last_modified).toLocaleDateString() : "previous";
            backupInfo = ` · Last backup: ${date}`;
        }
    } catch (e) { /* no backup info available */ }

    statusBar.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
                <strong style="color:var(--green);">✓ R2 Connected</strong>
                <span style="color:var(--text-muted);margin-left:8px;">${accountName ? escapeHtml(accountName) : ''} · Bucket: <code>${escapeHtml(bucketName || 'wintools-backup')}</code>${backupInfo}</span>
            </div>
            <button class="btn btn-sm" onclick="disconnectR2()" style="margin-left:auto;">Reconfigure</button>
        </div>`;
}

function disconnectR2() {
    // Clear stored credentials from server
    fetch(`${API}/migrate/r2-credentials`, { method: "DELETE" }).catch(() => {});

    // Clear form fields
    document.getElementById("r2-account-id").value = "";
    document.getElementById("r2-access-key").value = "";
    document.getElementById("r2-secret-key").value = "";
    document.getElementById("r2-bucket").value = "wintools-backup";
    document.getElementById("cf-api-token").value = "";
    const qcResult = document.getElementById("quick-connect-result");
    if (qcResult) { qcResult.textContent = ""; qcResult.className = "sync-status"; }
    const r2TestResult = document.getElementById("r2-test-result");
    if (r2TestResult) { r2TestResult.textContent = ""; r2TestResult.className = "sync-status"; }

    // Show setup cards again
    const quickConnect = document.querySelector(".sync-quickconnect");
    const manualCard = document.querySelector("#sync-backup .sync-card:nth-of-type(2)");
    if (quickConnect) quickConnect.style.display = "";
    if (manualCard) manualCard.style.display = "";

    // Restore backup buttons to initial state
    const btnBackup = document.getElementById("btn-backup-r2");
    if (btnBackup) btnBackup.textContent = "Encrypt & Upload to R2";
    const btnLocal = document.getElementById("btn-backup-local");
    if (btnLocal) btnLocal.style.display = "";

    // Remove connected status bar
    const statusBar = document.getElementById("r2-connected-status");
    if (statusBar) statusBar.remove();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function testR2Connection() {
    const resultEl = document.getElementById("r2-test-result");
    const btn = document.getElementById("btn-r2-test");
    resultEl.textContent = "Testing...";
    resultEl.className = "sync-status pending";
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/migrate/r2-test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getSyncCredentials()),
        });
        const data = await res.json();
        if (data.success) {
            resultEl.textContent = "✓ Connected!";
            resultEl.className = "sync-status success";
            showToast("R2 connection successful!", "success");
        } else {
            resultEl.textContent = `✗ ${data.message}`;
            resultEl.className = "sync-status error";
            showToast(`R2 connection failed: ${data.message}`, "error");
        }
    } catch (err) {
        resultEl.textContent = `✗ ${err.message}`;
        resultEl.className = "sync-status error";
    }
    btn.disabled = false;
}

async function backupToR2() {
    const btn = document.getElementById("btn-backup-r2");
    btn.disabled = true;
    btn.textContent = "Syncing to R2...";
    const resultEl = document.getElementById("backup-result");
    resultEl.textContent = "";

    try {
        const res = await fetch(`${API}/migrate/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: getSyncSelectedItems(),
                destination: "r2",
                credentials: getSyncCredentials(),
            }),
        });
        const data = await res.json();

        resultEl.textContent = "";
        if (data.success) {
            const card = createElement("div", { className: "result-card success" });
            card.appendChild(createElement("h4", {}, ["✓ Backup Successful"]));

            const details = createElement("pre");
            details.textContent = JSON.stringify(data.manifest?.items || {}, null, 2);
            card.appendChild(details);

            // Upload result
            if (data.upload?.success) {
                const uploadInfo = createElement("p", { style: "margin-top:8px;color:var(--green);" });
                uploadInfo.textContent = `Uploaded to R2: ${data.upload.object_key} (${(data.upload.size / 1024).toFixed(1)} KB)`;
                card.appendChild(uploadInfo);
            } else if (data.upload) {
                const uploadErr = createElement("p", { style: "margin-top:8px;color:var(--red);" });
                uploadErr.textContent = `R2 Upload failed: ${data.upload.message || "Unknown error"}`;
                card.appendChild(uploadErr);
            }

            // Key info — show option to save key (first time) or note it's saved
            const keyWarn = createElement("div", { className: "key-download" });
            keyWarn.innerHTML = `<strong>🔐 Encryption key saved locally.</strong> Future syncs reuse the same key. You can still download it for safekeeping.<br>
                <button class="btn btn-orange" style="margin-top:8px;" onclick="downloadKey()">Save Key File (.key)</button>`;
            card.appendChild(keyWarn);

            resultEl.appendChild(card);
            showToast("Backup synced!", "success");
        } else {
            const card = createElement("div", { className: "result-card error" });
            card.appendChild(createElement("h4", {}, ["✗ Backup Failed"]));
            card.appendChild(createElement("pre", {}, [data.error || "Unknown error"]));
            resultEl.appendChild(card);
            showToast(`Backup failed: ${data.error}`, "error");
        }
    } catch (err) {
        const card = createElement("div", { className: "result-card error" });
        card.appendChild(createElement("h4", {}, ["✗ Error"]));
        card.appendChild(createElement("pre", {}, [err.message]));
        resultEl.appendChild(card);
    }
    btn.disabled = false;
    // Restore button text based on R2 connection state
    const r2Creds = getSyncCredentials();
    btn.textContent = (r2Creds.account_id && r2Creds.access_key_id) ? "🔄 Sync to R2" : "Encrypt & Upload to R2";
}

async function backupToLocal() {
    const btn = document.getElementById("btn-backup-local");
    btn.disabled = true;
    btn.textContent = "Creating bundle...";
    const resultEl = document.getElementById("backup-result");
    resultEl.textContent = "";

    try {
        const res = await fetch(`${API}/migrate/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: getSyncSelectedItems(),
                destination: "local",
            }),
        });
        const data = await res.json();

        resultEl.textContent = "";
        if (data.success) {
            const card = createElement("div", { className: "result-card success" });
            card.appendChild(createElement("h4", {}, ["✓ Bundle Created"]));

            const sizeKB = (data.size / 1024).toFixed(1);
            card.appendChild(createElement("p", {}, [`Encrypted bundle size: ${sizeKB} KB`]));

            // Download button for bundle
            const dlBtn = createElement("button", { className: "btn btn-green" }, ["💾 Save Encrypted Bundle (.encrypted)"]);
            dlBtn.addEventListener("click", async () => {
                try {
                    const res = await fetch(`${API}/migrate/download-bundle`);
                    if (!res.ok) throw new Error("Failed to download bundle");
                    const arrayBuf = await res.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuf);
                    // Convert to base64 for pywebview save dialog
                    let binary = "";
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    const b64 = btoa(binary);

                    if (window.pywebview && window.pywebview.api && window.pywebview.api.saveFile) {
                        // pywebview: use native save dialog
                        const saved = await window.pywebview.api.saveFile(b64, "wintools-migration.encrypted");
                        if (saved) showToast("Bundle saved!", "success");
                        else showToast("Save cancelled.", "info");
                    } else {
                        // Browser: fall back to blob download
                        const blob = new Blob([bytes], { type: "application/octet-stream" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "wintools-migration.encrypted";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast("Bundle downloaded!", "success");
                    }
                } catch (e) {
                    showToast(`Download failed: ${e.message}`, "error");
                }
            });
            card.appendChild(dlBtn);

            // Key download
            const keyWarn = createElement("div", { className: "key-download" });
            keyWarn.innerHTML = `<strong>⚠ Save your encryption key!</strong> You need this .key file to restore your data. Do NOT store it in the same location as the bundle.<br>
                <button class="btn btn-orange" style="margin-top:8px;" onclick="downloadKey()">Download Key File (.key)</button>`;
            card.appendChild(keyWarn);

            resultEl.appendChild(card);
            showToast("Encrypted bundle ready for download!", "success");
        } else {
            const card = createElement("div", { className: "result-card error" });
            card.appendChild(createElement("h4", {}, ["✗ Export Failed"]));
            card.appendChild(createElement("pre", {}, [data.error || "Unknown error"]));
            resultEl.appendChild(card);
        }
    } catch (err) {
        const card = createElement("div", { className: "result-card error" });
        card.appendChild(createElement("h4", {}, ["✗ Error"]));
        card.appendChild(createElement("pre", {}, [err.message]));
        resultEl.appendChild(card);
    }
    btn.disabled = false;
    btn.textContent = "Save Encrypted Bundle";
}

async function downloadKey() {
    try {
        const res = await fetch(`${API}/migrate/download-key`);
        if (!res.ok) throw new Error("Failed to fetch key");
        const keyText = await res.text();

        // Try native download first
        try {
            const blob = new Blob([keyText], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "wintools-migration.key";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) { /* download may not work in pywebview */ }

        // Always show the key in a modal so the user can copy it
        showKeyModal(keyText);
    } catch (err) {
        showToast(`Failed to get key: ${err.message}`, "error");
    }
}

function showKeyModal(keyText) {
    // Remove existing modal if any
    const existing = document.getElementById("key-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "key-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;";

    const modal = document.createElement("div");
    modal.style.cssText = "background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow:auto;";
    modal.innerHTML = `
        <h3 style="margin:0 0 8px;color:var(--green);">⚠ Your Encryption Key</h3>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">
            Save this key somewhere safe! You <strong>cannot</strong> restore your backup without it.
            The key is never uploaded to R2. Copy it below or use the download button.
        </p>
        <textarea id="key-textarea" readonly style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);resize:vertical;">${keyText}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-accent" onclick="copyKeyToClipboard()">📋 Copy Key</button>
            <button class="btn btn-orange" onclick="saveKeyAsFile()">💾 Save as File</button>
            <button class="btn" onclick="document.getElementById('key-modal').remove()" style="margin-left:auto;">Close</button>
        </div>
    `;
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Select all text in textarea for easy copying
    const ta = document.getElementById("key-textarea");
    ta.focus();
    ta.select();
}

function copyKeyToClipboard() {
    const ta = document.getElementById("key-textarea");
    if (ta) {
        navigator.clipboard.writeText(ta.value).then(() => {
            showToast("Key copied to clipboard!", "success");
        }).catch(() => {
            ta.select();
            document.execCommand("copy");
            showToast("Key copied!", "success");
        });
    }
}

function saveKeyAsFile() {
    const ta = document.getElementById("key-textarea");
    if (!ta) return;
    const keyText = ta.value;

    // Try pywebview native save dialog first
    if (window.pywebview && window.pywebview.api && window.pywebview.api.saveTextFile) {
        window.pywebview.api.saveTextFile(keyText, "wintools-migration.key").then(saved => {
            if (saved) {
                showToast("Key file saved!", "success");
            } else {
                showToast("Save cancelled.", "info");
            }
        }).catch(() => {
            // Fallback to blob download
            _downloadKeyBlob(keyText);
        });
    } else {
        _downloadKeyBlob(keyText);
    }
}

function _downloadKeyBlob(keyText) {
    const blob = new Blob([keyText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wintools-migration.key";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function loadRestoreBundle() {
    const keyFile = document.getElementById("restore-key-file").files[0];
    const bundleFile = document.getElementById("restore-bundle-file").files[0];
    const resultEl = document.getElementById("restore-result");

    if (!keyFile) {
        showToast("Please select the encryption key file (.key)", "error");
        return;
    }
    if (!bundleFile) {
        showToast("Please select the encrypted bundle file (.encrypted)", "error");
        return;
    }

    resultEl.textContent = "";
    const loading = createElement("div", { className: "loading" }, ["Decrypting bundle..."]);
    resultEl.appendChild(loading);

    try {
        // Read key file
        restoreKey = await keyFile.text();

        // Upload bundle to server
        const formData = new FormData();
        formData.append("file", bundleFile);

        const uploadRes = await fetch(`${API}/migrate/upload-bundle`, {
            method: "POST",
            body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
            throw new Error(uploadData.error || "Failed to upload bundle");
        }

        // Decrypt and get manifest
        const decryptRes = await fetch(`${API}/migrate/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source: "local",
                key: restoreKey,
            }),
        });
        const decryptData = await decryptRes.json();

        if (!decryptData.success) {
            throw new Error(decryptData.error || "Failed to decrypt bundle");
        }

        restoreManifest = decryptData.manifest;
        resultEl.textContent = "";

        // Show checklist
        const wrapper = document.getElementById("restore-checklist-wrapper");
        wrapper.style.display = "";
        const checklist = document.getElementById("restore-checklist");
        checklist.textContent = "";

        const items = restoreManifest.items || {};
        const itemDefs = [
            { key: "ssh", label: "SSH Config (public keys only)", pathKey: "dir" },
            { key: "git", label: "Git Config", pathKey: "path" },
            { key: "envVars", label: "Environment Variables", pathKey: null },
            { key: "psProfile", label: "PowerShell 5 Profile", pathKey: "path" },
            { key: "ps7profile", label: "PowerShell 7 Profile", pathKey: "path" },
            { key: "gpg", label: "GPG Keys", pathKey: null },
            { key: "windowsTerminal", label: "Windows Terminal Settings", pathKey: "path" },
            { key: "claude", label: "Claude Code Config", pathKey: "path" },
            { key: "npm", label: "npm Global Packages", pathKey: null },
            { key: "copilot", label: "GitHub Copilot Config", pathKey: "path" },
        ];

        for (const def of itemDefs) {
            const item = items[def.key];
            if (!item) continue;

            const label = createElement("label", { className: "sync-check-item" });
            const checkbox = createElement("input", { type: "checkbox", name: "restore-item", value: def.key });
            checkbox.checked = true;

            const info = createElement("div", { className: "check-info" });
            info.appendChild(createElement("div", { className: "check-label" }, [def.label]));

            let detailText = "";
            if (def.key === "ssh") detailText = `${item.fileCount} file(s) — public keys & config only`;
            else if (def.key === "envVars") detailText = `${item.count} environment variable(s)`;
            else if (def.key === "npm") detailText = `${item.count} global package(s)`;
            else if (def.key === "gpg") detailText = `${item.keyCount} secret key(s)`;
            else if (def.key === "claude") detailText = `${item.fileCount || 0} file(s) including skills`;
            else if (def.key === "copilot") detailText = `${item.fileCount || 0} config file(s)`;
            else if (item[def.pathKey]) detailText = `From: ${item[def.pathKey]}`;

            info.appendChild(createElement("div", { className: "check-detail" }, [detailText]));
            label.append(checkbox, info);
            checklist.appendChild(label);
        }

        showToast("Bundle decrypted! Select items to restore.", "success");

    } catch (err) {
        resultEl.textContent = "";
        const card = createElement("div", { className: "result-card error" });
        card.appendChild(createElement("h4", {}, ["✗ Decryption Failed"]));
        card.appendChild(createElement("pre", {}, [err.message]));
        resultEl.appendChild(card);
        showToast(`Decryption failed: ${err.message}`, "error");
    }
}

async function applyRestore() {
    const resultEl = document.getElementById("restore-result");
    const btn = document.getElementById("btn-restore-apply");
    btn.disabled = true;
    btn.textContent = "Restoring...";

    const selectedItems = {};
    document.querySelectorAll("#restore-checklist input[name=restore-item]").forEach(cb => {
        selectedItems[cb.value] = cb.checked;
    });

    try {
        const res = await fetch(`${API}/migrate/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: selectedItems,
                key: restoreKey,
                source: "local",
            }),
        });
        const data = await res.json();

        resultEl.textContent = "";
        if (data.success) {
            const card = createElement("div", { className: "result-card success" });
            card.appendChild(createElement("h4", {}, ["✓ Restore Complete"]));

            const resultsList = createElement("div");
            for (const [key, result] of Object.entries(data.results || {})) {
                const itemDiv = createElement("div", { style: "margin:4px 0;font-size:13px;" });
                if (result.applied !== undefined) {
                    const applied = typeof result.applied === "number"
                        ? `${result.applied} item(s) restored`
                        : result.applied ? "Restored" : "Failed";
                    itemDiv.textContent = `${key}: ${applied}`;
                    itemDiv.style.color = result.applied ? "var(--green)" : "var(--red)";
                }
                resultsList.appendChild(itemDiv);
            }
            card.appendChild(resultsList);
            resultEl.appendChild(card);
            showToast("Restore completed!", "success");
        } else {
            const card = createElement("div", { className: "result-card error" });
            card.appendChild(createElement("h4", {}, ["✗ Restore Failed"]));
            card.appendChild(createElement("pre", {}, [data.error || "Unknown error"]));
            resultEl.appendChild(card);
        }
    } catch (err) {
        const card = createElement("div", { className: "result-card error" });
        card.appendChild(createElement("h4", {}, ["✗ Error"]));
        card.appendChild(createElement("pre", {}, [err.message]));
        resultEl.appendChild(card);
    }
    btn.disabled = false;
    btn.textContent = "Restore Selected Items";
}

// ── R2 Restore ─────────────────────────────────────────────────────

// Handle key file upload for R2 restore
document.addEventListener("DOMContentLoaded", () => {
    const keyFileInput = document.getElementById("restore-r2-key-file");
    if (keyFileInput) {
        keyFileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (file) {
                const keyText = await file.text();
                document.getElementById("restore-r2-key").value = keyText.trim();
            }
        });
    }
});

function getRestoreR2Credentials() {
    // Prefer restore-mode credential fields, fallback to backup-mode fields
    const accountId = document.getElementById("restore-r2-account-id")?.value?.trim()
        || document.getElementById("r2-account-id")?.value?.trim() || "";
    const accessKey = document.getElementById("restore-r2-access-key")?.value?.trim()
        || document.getElementById("r2-access-key")?.value?.trim() || "";
    const secretKey = document.getElementById("restore-r2-secret-key")?.value?.trim()
        || document.getElementById("r2-secret-key")?.value?.trim() || "";
    const bucket = document.getElementById("restore-r2-bucket")?.value?.trim()
        || document.getElementById("r2-bucket")?.value?.trim() || "wintools-backup";
    const computerName = (syncData && syncData.computerName) ? syncData.computerName : "";
    return {
        account_id: accountId,
        access_key_id: accessKey,
        secret_access_key: secretKey,
        bucket_name: bucket,
        ...(computerName && { computer_name: computerName }),
    };
}

async function loadR2Backups() {
    const keyText = document.getElementById("restore-r2-key").value.trim();
    if (!keyText) {
        showToast("Please enter your encryption key first", "error");
        return;
    }

    const creds = getRestoreR2Credentials();
    if (!creds.access_key_id) {
        showToast("Enter R2 credentials (expand R2 Credentials above)", "error");
        return;
    }

    const listEl = document.getElementById("r2-backup-list");
    listEl.style.display = "block";
    listEl.textContent = "";
    listEl.appendChild(createElement("div", { className: "loading" }, ["Loading backups from R2..."]));

    try {
        const res = await fetch(`${API}/migrate/r2-list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(creds),
        });
        const data = await res.json();

        if (!data.success) {
            listEl.textContent = "";
            listEl.appendChild(createElement("div", { style: "color:var(--red);font-size:13px;" }, [`Error: ${data.message}`]));
            return;
        }

        const backups = data.backups || [];
        if (backups.length === 0) {
            listEl.textContent = "";
            listEl.appendChild(createElement("div", { style: "color:var(--text-muted);font-size:13px;" }, ["No backups found in R2."]));
            return;
        }

        listEl.textContent = "";
        listEl.appendChild(createElement("div", { style: "font-size:13px;margin-bottom:8px;font-weight:600;" }, [`${backups.length} backup(s) found:`]));

        for (const backup of backups) {
            const date = new Date(backup.lastModified).toLocaleString();
            const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
            const fileName = backup.key.split("/").pop();
            const item = createElement("div", { className: "sync-check-item", style: "cursor:pointer;margin:4px 0;" });
            const info = createElement("div", { style: "flex:1;" });
            info.appendChild(createElement("div", { style: "font-size:13px;font-weight:600;" }, [date]));
            info.appendChild(createElement("div", { style: "font-size:11px;color:var(--text-muted);" }, [`${sizeMB} MB · ${fileName}`]));
            const btn = createElement("button", { className: "btn btn-sm" }, ["Restore"]);
            btn.addEventListener("click", () => restoreFromR2(backup.key));
            item.append(info, btn);
            listEl.appendChild(item);
        }
    } catch (err) {
        listEl.textContent = "";
        listEl.appendChild(createElement("div", { style: "color:var(--red);font-size:13px;" }, [`Error: ${err.message}`]));
    }
}

async function restoreFromR2(objectKey) {
    const keyText = document.getElementById("restore-r2-key").value.trim();
    if (!keyText) {
        showToast("Please enter your encryption key", "error");
        return;
    }

    const creds = getRestoreR2Credentials();
    if (!creds.access_key_id) {
        showToast("Enter R2 credentials (expand R2 Credentials above)", "error");
        return;
    }

    restoreKey = keyText;
    const resultEl = document.getElementById("restore-result");
    resultEl.textContent = "";
    resultEl.appendChild(createElement("div", { className: "loading" }, ["Downloading backup from R2..."]));

    try {
        // Download from R2
        const res = await fetch(`${API}/migrate/r2-download`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...creds, object_key: objectKey }),
        });
        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || data.message || "Failed to download from R2");
        }

        // The r2-download endpoint already saved to migration-upload.encrypted

        // Now decrypt and show manifest
        const decryptRes = await fetch(`${API}/migrate/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "local", key: restoreKey }),
        });
        const decryptData = await decryptRes.json();

        if (!decryptData.success) {
            throw new Error(decryptData.error || "Failed to decrypt bundle. Check your key.");
        }

        restoreManifest = decryptData.manifest;
        resultEl.textContent = "";

        // Show restore checklist
        const wrapper = document.getElementById("restore-checklist-wrapper");
        wrapper.style.display = "";
        const checklist = document.getElementById("restore-checklist");
        checklist.textContent = "";

        const items = restoreManifest.items || {};
        const itemDefs = [
            { key: "ssh", label: "SSH Config (public keys only)", pathKey: "dir" },
            { key: "git", label: "Git Config", pathKey: "path" },
            { key: "envVars", label: "Environment Variables", pathKey: null },
            { key: "psProfile", label: "PowerShell 5 Profile", pathKey: "path" },
            { key: "ps7profile", label: "PowerShell 7 Profile", pathKey: "path" },
            { key: "gpg", label: "GPG Keys", pathKey: null },
            { key: "windowsTerminal", label: "Windows Terminal Settings", pathKey: "path" },
            { key: "claude", label: "Claude Code Config", pathKey: "path" },
            { key: "npm", label: "npm Global Packages", pathKey: null },
            { key: "copilot", label: "GitHub Copilot Config", pathKey: "path" },
        ];

        for (const def of itemDefs) {
            const item = items[def.key];
            if (!item) continue;

            const label = createElement("label", { className: "sync-check-item" });
            const checkbox = createElement("input", { type: "checkbox", name: "restore-item", value: def.key });
            checkbox.checked = true;

            const info = createElement("div", { className: "check-info" });
            info.appendChild(createElement("div", { className: "check-label" }, [def.label]));

            let detailText = "";
            if (def.key === "ssh") detailText = `${item.fileCount} file(s) — public keys & config only`;
            else if (def.key === "envVars") detailText = `${item.count} environment variable(s)`;
            else if (def.key === "npm") detailText = `${item.count} global package(s)`;
            else if (def.key === "gpg") detailText = `${item.keyCount} secret key(s)`;
            else if (def.key === "claude") detailText = `${item.fileCount || 0} file(s) including skills`;
            else if (def.key === "copilot") detailText = `${item.fileCount || 0} config file(s)`;
            else if (item[def.pathKey]) detailText = `From: ${item[def.pathKey]}`;

            info.appendChild(createElement("div", { className: "check-detail" }, [detailText]));
            label.append(checkbox, info);
            checklist.appendChild(label);
        }

        showToast("Backup decrypted! Select items to restore.", "success");

    } catch (err) {
        resultEl.textContent = "";
        const card = createElement("div", { className: "result-card error" });
        card.appendChild(createElement("h4", {}, ["✗ Restore Failed"]));
        card.appendChild(createElement("pre", {}, [err.message]));
        resultEl.appendChild(card);
    }
}

// ── Tweaks (Windows Settings) ────────────────────────────────────────

let tweaksData = null;
let tweaksIsElevated = false;

async function loadTweaks() {
    const el = document.getElementById("tweaks-content");
    const resultEl = document.getElementById("tweaks-result");
    resultEl.textContent = "";
    showLoading(el, "Scanning Windows settings...");

    try {
        const res = await fetch(`${API}/tweaks`);
        const rawData = await res.json();

        // Extract admin status from meta
        const isElevated = rawData._meta && rawData._meta.is_admin;
        delete rawData._meta;

        tweaksData = rawData;
        tweaksIsElevated = isElevated;
        renderTweaks(tweaksData, isElevated);
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function renderTweaks(data, isElevated) {
    const el = document.getElementById("tweaks-content");
    el.textContent = "";

    // Show admin warning if not elevated
    if (!isElevated) {
        const banner = createElement("div", { className: "tweak-admin-banner" }, [
            "⚠️ Not running as Administrator — HKLM tweaks and service changes will fail. Right-click WinTools and select \"Run as Administrator\" for full access."
        ]);
        el.appendChild(banner);
    }

    const categoryIcons = {
        "Personalization": "🎨",
        "Privacy & Telemetry": "🔒",
        "Performance & Power": "⚡",
        "Security": "🛡️",
        "Hardening": "⚔️",
    };

    for (const [catName, catData] of Object.entries(data)) {
        const section = createElement("div", { className: "tweak-category" });

        // Category header with select all checkbox
        const header = createElement("div", { className: "tweak-category-header" });
        const icon = categoryIcons[catName] || catData.icon || "⚙";
        const catCheck = createElement("input", { type: "checkbox", id: `cat-${catName}`, className: "tweak-cat-checkbox" });
        catCheck.addEventListener("change", () => {
            const checked = catCheck.checked;
            section.querySelectorAll(".tweak-checkbox").forEach(cb => { cb.checked = checked; });
        });
        const catLabel = createElement("label", { className: "tweak-cat-label", htmlFor: `cat-${catName}` }, [
            `${icon} ${catName}`,
        ]);
        const catDesc = createElement("span", { className: "tweak-cat-desc" }, [catData.description]);
        header.append(catCheck, catLabel, catDesc);
        section.appendChild(header);

        // Tweak cards
        const grid = createElement("div", { className: "tweak-grid" });

        for (const tweak of catData.tweaks) {
            const riskClass = tweak.risk || "safe";
            const card = createElement("div", {
                className: `tweak-card${tweak.current_state === true ? " active" : ""}${tweak.script_only ? " script-only" : ""} risk-${riskClass}`,
            });

            // Checkbox + info row
            const topRow = createElement("div", { className: "tweak-top" });
            const checkbox = createElement("input", {
                type: "checkbox",
                className: "tweak-checkbox",
                id: `tweak-${tweak.id}`,
                value: tweak.id,
            });
            checkbox.addEventListener("change", updateTweakCount);
            checkbox.dataset.requiresAdmin = tweak.requires_admin ? "1" : "0";
            checkbox.dataset.scriptOnly = tweak.script_only ? "1" : "0";
            checkbox.dataset.risk = riskClass;
            if (tweak.warning) checkbox.dataset.warning = tweak.warning;
            checkbox.dataset.currentState = tweak.current_state === true ? "on" : tweak.current_state === false ? "off" : "unknown";

            const info = createElement("div", { className: "tweak-info" });
            const nameRow = createElement("div", { className: "tweak-name-row" });
            const name = createElement("span", { className: "tweak-name" }, [tweak.name]);

            // Badges
            const badges = createElement("span", { className: "tweak-badges" });
            if (tweak.recommended === "on") {
                badges.appendChild(createElement("span", { className: "badge badge-recommended" }, ["Recommended"]));
            }
            // Risk badge
            const riskLabels = { safe: "Safe", moderate: "Moderate", risky: "Risky" };
            const riskEmojis = { safe: "✅", moderate: "⚠️", risky: "🔴" };
            badges.appendChild(createElement("span", { className: `badge badge-risk-${riskClass}` }, [`${riskEmojis[riskClass] || ""} ${riskLabels[riskClass] || "Safe"}`]));
            if (tweak.requires_admin) {
                badges.appendChild(createElement("span", { className: "badge badge-admin" }, ["Admin"]));
            }
            if (tweak.script_only) {
                badges.appendChild(createElement("span", { className: "badge badge-script" }, ["Script Only"]));
            }
            nameRow.append(name, badges);
            info.appendChild(nameRow);

            const desc = createElement("div", { className: "tweak-desc" }, [tweak.description]);
            info.appendChild(desc);

            // Warning text
            if (tweak.warning) {
                const warningEl = createElement("div", { className: "tweak-warning" }, [tweak.warning]);
                info.appendChild(warningEl);
            }

            // Current state indicator
            const stateRow = createElement("div", { className: "tweak-state" });
            if (tweak.current_state === true) {
                stateRow.appendChild(createElement("span", { className: "state-on" }, ["✓ Enabled"]));
            } else if (tweak.current_state === false) {
                stateRow.appendChild(createElement("span", { className: "state-off" }, ["✗ Disabled"]));
            } else if (tweak.current_value === "need_admin") {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["🔒 Needs Admin to detect"]));
            } else if (tweak.current_value === "script_only") {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["📜 Script only — apply to enable"]));
            } else {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["Not set (default)"]));
            }
            if (tweak.current_value !== null && tweak.current_value !== undefined && tweak.current_value !== "need_admin" && tweak.current_value !== "script_only") {
                stateRow.appendChild(createElement("span", { className: "state-value" }, [` (current: ${tweak.current_value})`]));
            }
            info.appendChild(stateRow);

            topRow.append(checkbox, info);
            card.appendChild(topRow);
            grid.appendChild(card);
        }

        section.appendChild(grid);
        el.appendChild(section);
    }

    updateTweakCount();
}

function updateTweakCount() {
    const count = getSelectedTweakIds().length;
    const badge = document.getElementById("tweak-count-badge");
    const applyBtn = document.getElementById("btn-tweaks-apply");
    const revertBtn = document.getElementById("btn-tweaks-revert");
    if (badge) {
        badge.textContent = count > 0 ? count : "";
        badge.style.display = count > 0 ? "inline-flex" : "none";
    }
    if (applyBtn) applyBtn.disabled = count === 0;
    if (revertBtn) revertBtn.disabled = count === 0;
}

async function applySelectedTweaks() {
    const btn = document.getElementById("btn-tweaks-apply");
    const resultEl = document.getElementById("tweaks-result");
    const selected = getSelectedTweakIds();

    if (selected.length === 0) {
        showToast("Select at least one tweak to apply", "info");
        return;
    }

    // Build confirmation modal with all selected tweaks
    const tweaks = selected.map(id => {
        const cb = document.querySelector(`input[value="${id}"]`);
        if (!cb) return null;
        const card = cb.closest(".tweak-card");
        const name = card ? card.querySelector(".tweak-name").textContent : id;
        const risk = cb.dataset.risk || "safe";
        const warning = cb.dataset.warning || "";
        const currentState = cb.dataset.currentState || "unknown";
        return { id, name, risk, warning, currentState };
    }).filter(Boolean);

    const safeTweaks = tweaks.filter(t => t.risk === "safe");
    const moderateTweaks = tweaks.filter(t => t.risk === "moderate");
    const riskyTweaks = tweaks.filter(t => t.risk === "risky");

    // Show confirmation modal
    const overlay = createElement("div", { className: "modal-overlay" });
    const modal = createElement("div", { className: "modal-content tweak-confirm-modal" });
    const header = createElement("div", { className: "modal-header" }, [
        createElement("h3", {}, [`Apply ${selected.length} Tweak(s)`]),
    ]);

    const body = createElement("div", { className: "modal-body" });

    // Risk group sections
    const groups = [
        { label: "🔴 Risky", items: riskyTweaks, cls: "confirm-risky" },
        { label: "⚠️ Moderate", items: moderateTweaks, cls: "confirm-moderate" },
        { label: "✅ Safe", items: safeTweaks, cls: "confirm-safe" },
    ];
    for (const g of groups) {
        if (g.items.length === 0) continue;
        const section = createElement("div", { className: `confirm-group ${g.cls}` });
        section.appendChild(createElement("div", { className: "confirm-group-label" }, [`${g.label} (${g.items.length})`]));
        const list = createElement("div", { className: "confirm-list" });
        for (const t of g.items) {
            const item = createElement("div", { className: "confirm-item" });
            const stateLabel = t.currentState === "on" ? "✓ Already on"
                             : t.currentState === "off" ? "→ Will enable"
                             : "? Not set";
            const stateClass = t.currentState === "on" ? "confirm-state-on"
                             : t.currentState === "off" ? "confirm-state-off"
                             : "confirm-state-unknown";
            item.appendChild(createElement("span", { className: `confirm-item-name` }, [t.name]));
            item.appendChild(createElement("span", { className: `confirm-item-state ${stateClass}` }, [stateLabel]));
            if (t.warning) {
                const warn = createElement("div", { className: "confirm-item-warning" }, [t.warning]);
                item.appendChild(warn);
            }
            list.appendChild(item);
        }
        section.appendChild(list);
        body.appendChild(section);
    }

    // Admin note
    const adminTweaks = selected.filter(id => {
        const cb = document.querySelector(`input[value="${id}"]`);
        return cb && cb.dataset.requiresAdmin === "1";
    });
    if (adminTweaks.length > 0) {
        body.appendChild(createElement("div", { className: "confirm-admin-note" }, [
            `🔒 ${adminTweaks.length} tweak(s) require admin rights — may fail without elevation.`,
        ]));
    }

    const footer = createElement("div", { className: "modal-footer" });
    const cancelBtn = createElement("button", { className: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", () => { overlay.remove(); });
    const applyBtn2 = createElement("button", { className: "btn btn-accent" }, ["✓ Apply"]);
    applyBtn2.addEventListener("click", () => {
        overlay.remove();
        doApplyTweaks(btn, resultEl, selected);
    });
    footer.append(cancelBtn, applyBtn2);

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

async function doApplyTweaks(btn, resultEl, selected) {
    btn.disabled = true;
    btn.textContent = "Applying...";
    resultEl.textContent = "";

    try {
        const res = await fetch(`${API}/tweaks/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tweaks: selected, action: "apply" }),
        });
        const data = await res.json();

        if (data.success) {
            const card = createElement("div", { className: "tweak-result-card success" });
            card.appendChild(createElement("h4", {}, [`✓ Applied ${data.applied} tweak(s)`]));
            if (data.failed > 0) {
                card.appendChild(createElement("p", { style: "color:var(--orange);margin-top:4px;" }, [
                    `${data.failed} tweak(s) failed — may require admin rights or restart`
                ]));
            }
            const details = createElement("div", { className: "tweak-result-details" });
            for (const [id, result] of Object.entries(data.results)) {
                const item = createElement("div", { className: `tweak-result-item${result.success ? "" : " failed"}` });
                item.textContent = `${id}: ${result.success ? "✓ " + (result.message || "Applied") : "✗ " + (result.error || "Failed")}`;
                details.appendChild(item);
            }
            card.appendChild(details);
            resultEl.textContent = "";
            resultEl.appendChild(card);
            showToast(`Applied ${data.applied} tweak(s)!`, "success");
            setTimeout(() => loadTweaks(), 2000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "Apply Selected";
    updateTweakCount();

    btn.disabled = true;
    btn.textContent = "Applying...";
    resultEl.textContent = "";

    try {
        const res = await fetch(`${API}/tweaks/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tweaks: selected, action: "apply" }),
        });
        const data = await res.json();

        if (data.success) {
            const card = createElement("div", { className: "tweak-result-card success" });
            card.appendChild(createElement("h4", {}, [`✓ Applied ${data.applied} tweak(s)`]));
            if (data.failed > 0) {
                card.appendChild(createElement("p", { style: "color:var(--orange);margin-top:4px;" }, [
                    `${data.failed} tweak(s) failed — may require admin rights or restart`
                ]));
            }
            // Show individual results
            const details = createElement("div", { className: "tweak-result-details" });
            for (const [id, result] of Object.entries(data.results)) {
                const item = createElement("div", { className: `tweak-result-item${result.success ? "" : " failed"}` });
                item.textContent = `${id}: ${result.success ? "✓ " + (result.message || "Applied") : "✗ " + (result.error || "Failed")}`;
                details.appendChild(item);
            }
            card.appendChild(details);
            resultEl.textContent = "";
            resultEl.appendChild(card);
            showToast(`Applied ${data.applied} tweak(s)!`, "success");
            setTimeout(() => loadTweaks(), 2000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "Apply Selected";
    updateTweakCount();
}

async function revertSelectedTweaks() {
    const selected = getSelectedTweakIds();
    if (selected.length === 0) {
        showToast("Select at least one tweak to revert", "info");
        return;
    }

    // Build confirmation modal
    const tweaks = selected.map(id => {
        const cb = document.querySelector(`input[value="${id}"]`);
        if (!cb) return null;
        const card = cb.closest(".tweak-card");
        const name = card ? card.querySelector(".tweak-name").textContent : id;
        const currentState = cb.dataset.currentState || "unknown";
        return { id, name, currentState };
    }).filter(Boolean);

    const overlay = createElement("div", { className: "modal-overlay" });
    const modal = createElement("div", { className: "modal-content tweak-confirm-modal" });
    const header = createElement("div", { className: "modal-header" }, [
        createElement("h3", {}, [`↩ Revert ${selected.length} Tweak(s)`]),
    ]);

    const body = createElement("div", { className: "modal-body" });
    const note = createElement("div", { className: "confirm-admin-note" }, [
        "This will restore each selected tweak to its Windows default state.",
    ]);
    body.appendChild(note);
    const list = createElement("div", { className: "confirm-list" });
    for (const t of tweaks) {
        const item = createElement("div", { className: "confirm-item" });
        const stateLabel = t.currentState === "on" ? "↩ Will disable"
                         : t.currentState === "off" ? "✓ Already off"
                         : "? Unknown";
        const stateClass = t.currentState === "on" ? "confirm-state-off"
                         : t.currentState === "off" ? "confirm-state-on"
                         : "confirm-state-unknown";
        item.appendChild(createElement("span", { className: "confirm-item-name" }, [t.name]));
        item.appendChild(createElement("span", { className: `confirm-item-state ${stateClass}` }, [stateLabel]));
        list.appendChild(item);
    }
    body.appendChild(list);

    const footer = createElement("div", { className: "modal-footer" });
    const cancelBtn = createElement("button", { className: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", () => { overlay.remove(); });
    const revertBtn = createElement("button", { className: "btn btn-orange" }, ["↩ Revert"]);
    revertBtn.addEventListener("click", () => {
        overlay.remove();
        doRevertTweaks(selected);
    });
    footer.append(cancelBtn, revertBtn);

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

async function doRevertTweaks(selected) {
    const btn = document.getElementById("btn-tweaks-revert");
    const resultEl = document.getElementById("tweaks-result");
    btn.disabled = true;
    btn.textContent = "Reverting...";
    resultEl.textContent = "";

    try {
        const res = await fetch(`${API}/tweaks/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tweaks: selected, action: "revert" }),
        });
        const data = await res.json();

        if (data.success) {
            const card = createElement("div", { className: "tweak-result-card" });
            card.style.borderColor = "var(--orange)";
            card.style.background = "var(--orange-bg)";
            card.appendChild(createElement("h4", {}, [`↩ Reverted ${data.applied} tweak(s)`]));
            const details = createElement("div", { className: "tweak-result-details" });
            for (const [id, result] of Object.entries(data.results)) {
                const item = createElement("div", { className: `tweak-result-item${result.success ? "" : " failed"}` });
                item.textContent = `${id}: ${result.success ? "✓ " + (result.message || "Reverted") : "✗ " + (result.error || "Failed")}`;
                details.appendChild(item);
            }
            card.appendChild(details);
            resultEl.textContent = "";
            resultEl.appendChild(card);
            showToast(`Reverted ${data.applied} tweak(s)!`, "success");
            setTimeout(() => loadTweaks(), 2000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "Revert Selected";
    updateTweakCount();
}

function getSelectedTweakIds() {
    const ids = [];
    document.querySelectorAll(".tweak-checkbox:checked").forEach(cb => {
        ids.push(cb.value);
    });
    return ids;
}

function selectAllTweaks(checked) {
    document.querySelectorAll(".tweak-checkbox").forEach(cb => {
        cb.checked = checked;
    });
    // Also toggle category checkboxes
    document.querySelectorAll(".tweak-cat-checkbox").forEach(cb => {
        cb.checked = checked;
        cb.indeterminate = false;
    });
    updateTweakCount();
}

// ── Windows Options & Tools ────────────────────────────────────────────

let winoptionsData = null;
let winoptionsIsElevated = false;

async function loadWinOptions() {
    const el = document.getElementById("winoptions-content");
    const resultEl = document.getElementById("winoptions-result");
    resultEl.textContent = "";
    showLoading(el, "Scanning Windows options...");

    try {
        const res = await fetch(`${API}/winoptions`);
        const rawData = await res.json();
        const isElevated = rawData._meta && rawData._meta.is_admin;
        delete rawData._meta;
        winoptionsData = rawData;
        winoptionsIsElevated = isElevated;
        renderWinOptions(winoptionsData, isElevated);
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function renderWinOptions(data, isElevated) {
    const el = document.getElementById("winoptions-content");
    el.textContent = "";

    if (!isElevated) {
        const banner = createElement("div", { className: "wo-banner" }, [
            "⚠️ Not running as Administrator — most options require admin rights. Right-click WinTools and select \"Run as Administrator\"."
        ]);
        el.appendChild(banner);
    }

    for (const [catName, catData] of Object.entries(data)) {
        const section = createElement("div", { className: "wo-section" });
        const header = createElement("div", { className: "wo-section-header" });
        const icon = catData.icon || "⚙";

        header.appendChild(createElement("span", { className: "wo-section-icon" }, [icon]));
        header.appendChild(createElement("span", { className: "wo-section-title" }, [catName]));
        header.appendChild(createElement("span", { className: "wo-section-desc" }, [catData.description]));
        section.appendChild(header);

        const list = createElement("div", { className: "wo-list" });

        for (const option of catData.options) {
            const isAction = option.type === "action";
            const isOn = option.current_state === true;
            const row = createElement("div", {
                className: `wo-row${isOn ? " wo-on" : ""}${isAction ? " wo-action" : ""}`,
            });
            row.dataset.id = option.id;
            row.dataset.type = option.type;
            row.dataset.risk = option.risk || "safe";
            if (option.reboot_required) row.dataset.reboot = "1";
            if (option.requires_admin) row.dataset.admin = "1";

            // Left side: name + description
            const left = createElement("div", { className: "wo-left" });
            const nameLine = createElement("div", { className: "wo-name-line" });
            nameLine.appendChild(createElement("span", { className: "wo-name" }, [option.name]));

            // Compact badges
            const badges = createElement("span", { className: "wo-badges" });
            if (option.recommended === "on") badges.appendChild(createElement("span", { className: "wo-badge wo-badge-rec" }, ["On"]));
            if (option.reboot_required) badges.appendChild(createElement("span", { className: "wo-badge wo-badge-reboot" }, ["Reboot"]));
            if (isAction) badges.appendChild(createElement("span", { className: "wo-badge wo-badge-run" }, ["Action"]));
            if (option.risk === "risky") badges.appendChild(createElement("span", { className: "wo-badge wo-badge-risk" }, ["⚠ Risky"]));
            if (option.risk === "moderate") badges.appendChild(createElement("span", { className: "wo-badge wo-badge-mod" }, ["Moderate"]));
            if (option.requires_admin) badges.appendChild(createElement("span", { className: "wo-badge wo-badge-admin" }, ["Admin"]));
            nameLine.appendChild(badges);
            left.appendChild(nameLine);

            left.appendChild(createElement("div", { className: "wo-desc" }, [option.description]));

            if (option.warning) {
                left.appendChild(createElement("div", { className: "wo-warning" }, [option.warning]));
            }

            // State line
            const stateLine = createElement("div", { className: "wo-state" });
            if (isAction) {
                stateLine.appendChild(createElement("span", { className: "wo-state-action" }, ["One-time action"]));
            } else if (isOn) {
                stateLine.appendChild(createElement("span", { className: "wo-state-on" }, ["Enabled"]));
            } else if (option.current_state === false) {
                stateLine.appendChild(createElement("span", { className: "wo-state-off" }, ["Disabled"]));
            } else if (option.current_value === "Not available" || option.current_value === "need_admin") {
                stateLine.appendChild(createElement("span", { className: "wo-state-unknown" }, ["Not available"]));
            } else {
                stateLine.appendChild(createElement("span", { className: "wo-state-unknown" }, ["Default"]));
            }
            if (option.current_value && option.current_value !== "action" && option.current_value !== "Not available" && option.current_value !== "need_admin") {
                stateLine.appendChild(createElement("span", { className: "wo-state-val" }, [option.current_value]));
            }
            left.appendChild(stateLine);

            // Right side: toggle switch or run button
            const right = createElement("div", { className: "wo-right" });
            if (isAction) {
                const runBtn = createElement("button", { className: "wo-run-btn", title: option.name });
                runBtn.textContent = "▶ Run";
                runBtn.addEventListener("click", async () => {
                    runBtn.disabled = true;
                    runBtn.textContent = "Running…";
                    try {
                        const res = await fetch(`${API}/winoptions/apply`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ options: [option.id], action: "apply" }),
                        });
                        const result = await res.json();
                        const r = result.results[option.id] || {};
                        if (r.success) {
                            runBtn.textContent = "✓ Done";
                            runBtn.classList.add("wo-run-done");
                            showToast(`${option.name}: ${r.message || "Completed"}`, "success");
                        } else {
                            runBtn.textContent = "✗ Failed";
                            runBtn.classList.add("wo-run-fail");
                            showToast(`${option.name}: ${r.error || "Failed"}`, "error");
                        }
                    } catch (err) {
                        runBtn.textContent = "✗ Error";
                        runBtn.classList.add("wo-run-fail");
                        showToast(`${option.name}: ${err.message}`, "error");
                    }
                    setTimeout(() => {
                        runBtn.disabled = false;
                        runBtn.textContent = "▶ Run";
                        runBtn.classList.remove("wo-run-done", "wo-run-fail");
                    }, 3000);
                });
                right.appendChild(runBtn);
            } else {
                // Toggle switch — applies immediately on change
                const toggle = createElement("label", { className: "wo-toggle" });
                const input = createElement("input", { type: "checkbox", className: "wo-toggle-input", id: `wo-${option.id}`, "aria-label": option.name });
                input.value = option.id;
                input.checked = isOn;
                input.dataset.type = "toggle";
                input.dataset.risk = option.risk || "safe";
                input.dataset.rebootRequired = option.reboot_required ? "1" : "0";
                input.dataset.optionId = option.id;
                if (option.warning) input.dataset.warning = option.warning;
                input.dataset.currentState = isOn ? "on" : option.current_state === false ? "off" : "unknown";

                // Apply immediately when toggled
                input.addEventListener("change", async function() {
                    const oid = this.dataset.optionId;
                    const wantOn = this.checked;
                    const action = wantOn ? "apply" : "revert";
                    const row = this.closest(".wo-row");

                    // Show loading on the toggle
                    this.disabled = true;
                    row.classList.add("wo-loading");

                    try {
                        const res = await fetch(`${API}/winoptions/apply`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ options: [oid], action: action }),
                        });
                        const data = await res.json();
                        const r = data.results[oid] || {};
                        if (r.success) {
                            row.classList.toggle("wo-on", wantOn);
                            this.checked = wantOn;
                            // Update state text
                            const stateEl = row.querySelector(".wo-state-on, .wo-state-off, .wo-state-unknown");
                            if (stateEl) {
                                stateEl.className = wantOn ? "wo-state-on" : "wo-state-off";
                                stateEl.textContent = wantOn ? "Enabled" : "Disabled";
                            }
                            const verb = wantOn ? "Enabled" : "Disabled";
                            showToast(`${option.name}: ${verb}`, "success");
                            if (data.reboot_required) {
                                showToast("💻 Reboot required for some changes", "info");
                            }
                            // Rescan after a short delay
                            setTimeout(() => loadWinOptions(), 1500);
                        } else {
                            // Revert the toggle visually
                            this.checked = !wantOn;
                            row.classList.toggle("wo-on", this.checked);
                            showToast(`${option.name}: ${r.error || "Failed"}`, "error");
                        }
                    } catch (err) {
                        this.checked = !wantOn;
                        row.classList.toggle("wo-on", this.checked);
                        showToast(`${option.name}: ${err.message}`, "error");
                    }
                    this.disabled = false;
                    row.classList.remove("wo-loading");
                });

                const slider = createElement("span", { className: "wo-toggle-slider" });
                toggle.append(input, slider);
                right.appendChild(toggle);
            }

            row.append(left, right);
            list.appendChild(row);
        }

        section.appendChild(list);
        el.appendChild(section);
    }
}

async function applySelectedWinOptions() {
    // Kept for compatibility but toggles apply immediately now
    showToast("Toggle switches apply automatically when flipped", "info");
}

async function revertSelectedWinOptions() {
    // Kept for compatibility but toggles apply immediately now
    showToast("Toggle switches apply automatically — just flip them off", "info");
}

async function runSelectedWinOptions() {
    showToast("Use the ▶ Run button on each action item", "info");
}

function selectAllWinOptions(checked) {
    // No longer needed — toggles are instant
}

function updateWinOptionCount() {
    // No longer needed — no batch buttons
}

async function doWinOptionAction(selected, action) {
    const resultEl = document.getElementById("winoptions-result");
    resultEl.textContent = "";

    const verb = action === "revert" ? "Reverting" : "Applying";
    resultEl.appendChild(createElement("div", { className: "loading" }, [`${verb} ${selected.length} option(s)...`]));

    try {
        const res = await fetch(`${API}/winoptions/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ options: selected, action: action }),
        });
        const data = await res.json();

        if (data.success) {
            resultEl.textContent = "";
            const verbPast = action === "revert" ? "Reverted" : "Applied";
            const card = createElement("div", { className: "wo-result success" });
            card.appendChild(createElement("h4", {}, [`${verbPast} ${data.applied} option(s)`]));
            if (data.failed > 0) {
                card.appendChild(createElement("p", { style: "color:var(--orange);margin-top:4px;" }, [
                    `${data.failed} option(s) failed`
                ]));
            }
            if (data.reboot_required) {
                card.appendChild(createElement("div", { className: "wo-reboot-warning" }, [
                    "💻 A reboot is required for some changes to take effect."
                ]));
            }
            const details = createElement("div", { className: "wo-result-details" });
            for (const [id, result] of Object.entries(data.results)) {
                const item = createElement("div", { className: `wo-result-item${result.success ? "" : " failed"}` });
                item.textContent = `${id}: ${result.success ? "✓ " + (result.message || "OK") : "✗ " + (result.error || "Failed")}`;
                details.appendChild(item);
            }
            card.appendChild(details);
            resultEl.appendChild(card);
            showToast(`${verbPast} ${data.applied} option(s)!`, "success");
            setTimeout(() => loadWinOptions(), 2000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
            resultEl.textContent = "";
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
        resultEl.textContent = "";
    }
}

// ── Privacy & Security Tab ─────────────────────────────────────────

let privacyData = null;
let privacyIsElevated = false;
let quicksetupData = null;
let quicksetupIsElevated = false;

async function loadPrivacy() {
    const el = document.getElementById("privacy-content");
    const resultEl = document.getElementById("privacy-result");
    resultEl.textContent = "";
    showLoading(el, "Scanning privacy settings...");

    try {
        const res = await fetch(`${API}/privacy`);
        const rawData = await res.json();

        // Extract admin status from meta
        const isElevated = rawData._meta && rawData._meta.is_admin;
        delete rawData._meta;

        privacyData = rawData;
        privacyIsElevated = isElevated;
        renderPrivacy(privacyData, isElevated);
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function renderPrivacy(data, isElevated) {
    const el = document.getElementById("privacy-content");
    el.textContent = "";

    // Show admin warning if not elevated
    if (!isElevated) {
        const banner = createElement("div", { className: "tweak-admin-banner" }, [
            "⚠️ Not running as Administrator — some settings require HKLM access and will fail. Right-click WinTools and select \"Run as Administrator\" for full access."
        ]);
        el.appendChild(banner);
    }

    // Search bar
    const searchInput = document.getElementById("privacy-search");
    if (searchInput) {
        searchInput.oninput = () => filterPrivacySettings(searchInput.value);
    }

    for (const [catName, catData] of Object.entries(data)) {
        if (catName === "_meta") continue;
        const section = createElement("div", { className: "privacy-category" });
        section.dataset.category = catName;

        // Category header (accordion)
        const header = createElement("div", { className: "privacy-category-header" });
        const icon = catData.icon || "🔒";
        const settings = catData.settings || catData.tweaks || [];
        const enabledCount = settings.filter(s => s.current_state === true).length;
        const totalCount = settings.length;

        header.appendChild(createElement("span", { className: "privacy-category-icon" }, [icon]));
        header.appendChild(createElement("span", { className: "privacy-category-name" }, [catName]));
        header.appendChild(createElement("span", { className: "privacy-category-count" }, [`${enabledCount}/${totalCount} enabled`]));
        header.appendChild(createElement("span", { className: "privacy-category-chevron" }, ["▸"]));

        header.addEventListener("click", () => {
            const body = section.querySelector(".privacy-category-body");
            const chevron = header.querySelector(".privacy-category-chevron");
            if (body.style.maxHeight && body.style.maxHeight !== "0px") {
                body.style.maxHeight = "0px";
                chevron.textContent = "▸";
                header.classList.remove("expanded");
            } else {
                body.style.maxHeight = body.scrollHeight + "px";
                chevron.textContent = "▾";
                header.classList.add("expanded");
            }
        });
        section.appendChild(header);

        // Category body
        const body = createElement("div", { className: "privacy-category-body" });
        body.style.maxHeight = "0px";
        body.style.overflow = "hidden";
        body.style.transition = "max-height 0.3s ease";

        // Description
        if (catData.description) {
            body.appendChild(createElement("p", { className: "privacy-category-desc" }, [catData.description]));
        }

        // Settings grid
        const grid = createElement("div", { className: "privacy-grid" });

        for (const setting of settings) {
            const riskClass = setting.risk || "safe";
            const card = createElement("div", {
                className: `privacy-card${setting.current_state === true ? " active" : ""} risk-${riskClass}`,
                dataset: { id: setting.id },
            });

            // Top row: toggle + info
            const topRow = createElement("div", { className: "privacy-top" });

            // Toggle switch (like wo-toggle)
            const toggleLabel = createElement("label", { className: "wo-toggle" });
            const toggleInput = createElement("input", {
                type: "checkbox",
                className: "wo-toggle-input",
                id: `priv-${setting.id}`,
                "aria-label": setting.name,
            });
            toggleInput.checked = setting.current_state === true;
            toggleInput.dataset.id = setting.id;
            toggleInput.dataset.requiresAdmin = setting.requires_admin ? "1" : "0";
            toggleInput.dataset.risk = riskClass;
            if (setting.warning) toggleInput.dataset.warning = setting.warning;

            toggleInput.addEventListener("change", async () => {
                const action = toggleInput.checked ? "apply" : "revert";
                await togglePrivacySetting(setting.id, action, toggleInput, card);
            });

            const toggleSlider = createElement("span", { className: "wo-toggle-slider" });
            toggleLabel.append(toggleInput, toggleSlider);

            // Info section
            const info = createElement("div", { className: "privacy-info" });
            const nameRow = createElement("div", { className: "privacy-name-row" });
            nameRow.appendChild(createElement("span", { className: "privacy-name" }, [setting.name]));

            // Badges
            const badges = createElement("span", { className: "tweak-badges" });
            if (setting.recommended === "on" && setting.current_state !== true) {
                badges.appendChild(createElement("span", { className: "badge badge-recommended" }, ["Recommended"]));
            }
            const riskLabels = { safe: "Safe", moderate: "Moderate", risky: "Risky" };
            const riskEmojis = { safe: "✅", moderate: "⚠️", risky: "🔴" };
            badges.appendChild(createElement("span", { className: `badge badge-risk-${riskClass}` }, [`${riskEmojis[riskClass] || ""} ${riskLabels[riskClass] || "Safe"}`]));
            if (setting.requires_admin) {
                badges.appendChild(createElement("span", { className: "badge badge-admin" }, ["Admin"]));
            }
            if (setting.allowlist_support) {
                badges.appendChild(createElement("span", { className: "badge badge-allowlist" }, ["⚙ Exceptions"]));
            }
            nameRow.appendChild(badges);
            info.appendChild(nameRow);

            info.appendChild(createElement("div", { className: "privacy-desc" }, [setting.description]));

            if (setting.warning) {
                info.appendChild(createElement("div", { className: "tweak-warning" }, [setting.warning]));
            }

            // State indicator
            const stateRow = createElement("div", { className: "tweak-state" });
            if (setting.current_state === true) {
                stateRow.appendChild(createElement("span", { className: "state-on" }, ["✓ Enabled"]));
            } else if (setting.current_state === false) {
                stateRow.appendChild(createElement("span", { className: "state-off" }, ["✗ Disabled"]));
            } else if (setting.current_value === "need_admin") {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["🔒 Needs Admin to detect"]));
            } else {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["Not set (default)"]));
            }
            info.appendChild(stateRow);

            // Allowlist button
            if (setting.allowlist_support) {
                const allowlistBtn = createElement("button", {
                    className: "btn btn-sm privacy-allowlist-btn",
                    title: "Manage app exceptions",
                }, ["⚙ Exceptions"]);
                allowlistBtn.addEventListener("click", () => showAllowlistDialog(setting.id, setting.name));
                info.appendChild(allowlistBtn);
            }

            topRow.append(toggleLabel, info);
            card.appendChild(topRow);
            grid.appendChild(card);
        }

        body.appendChild(grid);
        section.appendChild(body);
        el.appendChild(section);
    }

    // Auto-expand first category
    const firstHeader = el.querySelector(".privacy-category-header");
    if (firstHeader) {
        firstHeader.click();
    }
}

async function togglePrivacySetting(id, action, toggleInput, card) {
    toggleInput.disabled = true;
    const resultEl = document.getElementById("privacy-result");

    try {
        const res = await fetch(`${API}/privacy/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: [id], action: action }),
        });
        const data = await res.json();

        if (data.success) {
            const result = data.results[id] || {};
            if (result.success) {
                showToast(`${id}: ${result.message || (action === "apply" ? "Enabled" : "Disabled")}`, "success");
                // Update card state locally
                if (action === "apply") {
                    card.classList.add("active");
                } else {
                    card.classList.remove("active");
                }
                // Update state text
                const stateRow = card.querySelector(".tweak-state");
                if (stateRow) {
                    stateRow.textContent = "";
                    stateRow.appendChild(createElement("span", { className: action === "apply" ? "state-on" : "state-off" }, [action === "apply" ? "✓ Enabled" : "✗ Disabled"]));
                }
                // Update the cached data so re-renders reflect the change
                if (privacyData) {
                    for (const [catName, catData] of Object.entries(privacyData)) {
                        if (catName === "_meta") continue;
                        for (const setting of (catData.settings || [])) {
                            if (setting.id === id) {
                                setting.current_state = action === "apply";
                                setting.current_value = action === "apply" ? "on" : "off";
                                break;
                            }
                        }
                    }
                }
            } else {
                showToast(`${id}: ${result.error || "Failed"}`, "error");
                // Revert toggle
                toggleInput.checked = !toggleInput.checked;
            }
            if (data.reboot_required) {
                showToast("💻 A reboot may be required for some changes to take effect", "info");
            }
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
            toggleInput.checked = !toggleInput.checked;
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
        toggleInput.checked = !toggleInput.checked;
    }

    toggleInput.disabled = false;
}

function filterPrivacySettings(query) {
    const q = query.toLowerCase().trim();
    const categories = document.querySelectorAll(".privacy-category");

    categories.forEach(cat => {
        const cards = cat.querySelectorAll(".privacy-card");
        let visibleCount = 0;

        cards.forEach(card => {
            const name = card.querySelector(".privacy-name")?.textContent?.toLowerCase() || "";
            const desc = card.querySelector(".privacy-desc")?.textContent?.toLowerCase() || "";
            if (!q || name.includes(q) || desc.includes(q)) {
                card.style.display = "";
                visibleCount++;
            } else {
                card.style.display = "none";
            }
        });

        // Hide category if no visible cards
        if (visibleCount === 0 && q) {
            cat.style.display = "none";
        } else {
            cat.style.display = "";
            // Auto-expand if searching and has matches
            if (q && visibleCount > 0) {
                const body = cat.querySelector(".privacy-category-body");
                const header = cat.querySelector(".privacy-category-header");
                if (body && body.style.maxHeight === "0px") {
                    header.click();
                }
            }
        }
    });
}

async function showAllowlistDialog(settingId, settingName) {
    const overlay = createElement("div", { className: "modal-overlay" });
    const modal = createElement("div", { className: "modal-content privacy-allowlist-modal" });
    const header = createElement("div", { className: "modal-header" }, [
        createElement("h3", {}, [`⚙ App Exceptions for "${settingName}"`]),
    ]);

    const body = createElement("div", { className: "modal-body" });
    body.appendChild(createElement("p", { className: "privacy-allowlist-desc" }, [
        "Apps in this list will be exempt from this privacy restriction. Add apps that need access even when the restriction is enabled."
    ]));

    // Current allowlist entries
    const entriesContainer = createElement("div", { className: "privacy-allowlist-entries" });
    entriesContainer.appendChild(createElement("div", { className: "loading" }, ["Loading exceptions..."]));
    body.appendChild(entriesContainer);

    // Add app section
    const addSection = createElement("div", { className: "privacy-allowlist-add" });
    addSection.appendChild(createElement("h4", {}, ["Add App Exception"]));

    const addRow = createElement("div", { className: "privacy-add-row" });
    const appSelect = createElement("select", { className: "privacy-app-select", id: `allowlist-app-${settingId}` });
    appSelect.appendChild(createElement("option", { value: "" }, ["-- Select an installed app --"]));
    addRow.appendChild(appSelect);

    const addBtn = createElement("button", { className: "btn btn-sm btn-accent" }, ["Add"]);
    addBtn.addEventListener("click", async () => {
        const select = document.getElementById(`allowlist-app-${settingId}`);
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption || !selectedOption.value) return;

        const appId = selectedOption.value;
        const appName = selectedOption.textContent;
        const appType = selectedOption.dataset.type || "exe_path";

        try {
            const res = await fetch(`${API}/privacy/allowlist/${settingId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: appName, id: appId, type: appType }),
            });
            const data = await res.json();
            if (data.success) {
                // Check if the registry write actually succeeded
                const regResult = data.registry_result;
                if (regResult && !regResult.success) {
                    showToast(`Registry error: ${regResult.error || "Failed to write"}`, "error");
                } else {
                    showToast(`Added "${appName}" to exceptions`, "success");
                }
                // Reload the allowlist
                loadAllowlistEntries(settingId, entriesContainer);
            } else {
                showToast(`Error: ${data.error || "Failed to add"}`, "error");
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, "error");
        }
    });
    addRow.appendChild(addBtn);
    addSection.appendChild(addRow);

    // Manual path entry
    const manualSection = createElement("div", { className: "privacy-manual-entry" });
    manualSection.appendChild(createElement("h4", {}, ["Or enter manually:"]));
    const manualRow = createElement("div", { className: "privacy-add-row" });
    const manualInput = createElement("input", {
        type: "text",
        className: "privacy-manual-input",
        placeholder: "e.g. C:\\Program Files\\MyApp\\app.exe",
        id: `allowlist-manual-${settingId}`,
    });
    manualRow.appendChild(manualInput);
    const manualBtn = createElement("button", { className: "btn btn-sm" }, ["Add Manual Path"]);
    manualBtn.addEventListener("click", async () => {
        const path = manualInput.value.trim();
        if (!path) return;
        try {
            const res = await fetch(`${API}/privacy/allowlist/${settingId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: path.split("\\").pop() || path, id: path, type: "exe_path" }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Added "${path}" to exceptions`, "success");
                manualInput.value = "";
                loadAllowlistEntries(settingId, entriesContainer);
            } else {
                showToast(`Error: ${data.error || "Failed"}`, "error");
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, "error");
        }
    });
    manualRow.appendChild(manualBtn);
    manualSection.appendChild(manualRow);
    body.appendChild(addSection);
    body.appendChild(manualSection);

    const footer = createElement("div", { className: "modal-footer" });
    const closeBtn = createElement("button", { className: "btn" }, ["Close"]);
    closeBtn.addEventListener("click", () => overlay.remove());
    footer.appendChild(closeBtn);

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Load allowlist entries and app list
    loadAllowlistEntries(settingId, entriesContainer);
    loadInstalledAppsForAllowlist(settingId, appSelect);
}

async function loadAllowlistEntries(settingId, container) {
    container.textContent = "";
    try {
        const res = await fetch(`${API}/privacy/allowlist/${settingId}`);
        const data = await res.json();
        const entries = data.entries || [];

        if (entries.length === 0) {
            container.appendChild(createElement("div", { className: "privacy-allowlist-empty" }, ["No app exceptions configured."]));
            return;
        }

        for (const entry of entries) {
            const row = createElement("div", { className: "privacy-allowlist-entry" });
            row.appendChild(createElement("span", { className: "privacy-allowlist-name" }, [entry.name || entry.id]));
            row.appendChild(createElement("span", { className: "privacy-allowlist-type" }, [entry.type === "package_family" ? "UWP App" : "Desktop App"]));
            const removeBtn = createElement("button", { className: "btn btn-sm btn-danger" }, ["✕ Remove"]);
            removeBtn.addEventListener("click", async () => {
                try {
                    const res = await fetch(`${API}/privacy/allowlist/${settingId}/${encodeURIComponent(entry.id)}`, {
                        method: "DELETE",
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`Removed "${entry.name}" from exceptions`, "success");
                        loadAllowlistEntries(settingId, container);
                    } else {
                        showToast(`Error: ${data.error || "Failed"}`, "error");
                    }
                } catch (err) {
                    showToast(`Error: ${err.message}`, "error");
                }
            });
            row.appendChild(removeBtn);
            container.appendChild(row);
        }
    } catch (err) {
        container.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

async function loadInstalledAppsForAllowlist(settingId, selectEl) {
    try {
        const res = await fetch(`${API}/privacy/installed-apps`);
        const data = await res.json();
        const apps = data.apps || [];

        for (const app of apps) {
            const option = createElement("option", { value: app.id, dataset: { type: app.type } }, [app.name]);
            selectEl.appendChild(option);
        }
    } catch (err) {
        // App list loading failed - user can still add manually
    }
}

// ── Quick Setup Tab ────────────────────────────────────────────────

function loadQuickSetup() {
    fetch("/api/quicksetup")
        .then(r => r.json())
        .then(data => {
            quicksetupData = data;
            quicksetupIsElevated = data._meta?.is_admin ?? false;
            delete data._meta;
            renderQuickSetup(data, quicksetupIsElevated);
        })
        .catch(err => {
            console.error("Error loading Quick Setup:", err);
            document.getElementById("quicksetup-content").innerHTML =
                '<div class="error">Failed to load Quick Setup settings. Make sure the app is running with appropriate permissions.</div>';
        });
}

function renderQuickSetup(data, isElevated) {
    const container = document.getElementById("quicksetup-content");
    container.innerHTML = "";

    // Admin banner
    if (!isElevated) {
        const banner = createElement("div", { className: "tweak-admin-banner" }, [
            "⚠️ Running without admin privileges. Some settings may not be available. ",
            createElement("a", { href: "#", className: "admin-restart" }, ["Restart as Administrator"])
        ]);
        container.appendChild(banner);
    }

    // Render each category as an accordion section (same pattern as Privacy tab)
    for (const [catName, catData] of Object.entries(data)) {
        const settings = catData.settings || [];
        const enabledCount = settings.filter(s => s.current_state === true).length;

        const section = createElement("div", { className: "privacy-category" }, [
            createElement("div", { className: "privacy-category-header" }, [
                createElement("span", { className: "privacy-category-icon" }, [catData.icon]),
                createElement("span", { className: "privacy-category-name" }, [catName]),
                createElement("span", { className: "privacy-category-count" }, [`${enabledCount}/${settings.length} enabled`]),
                createElement("span", { className: "privacy-category-toggle" }, ["▼"])
            ]),
            createElement("div", { className: "privacy-category-desc" }, [catData.description])
        ]);

        const grid = createElement("div", { className: "privacy-cards" });

        for (const setting of settings) {
            const card = createQuickSetupCard(setting, isElevated);
            grid.appendChild(card);
        }

        section.appendChild(grid);
        container.appendChild(section);
    }

    // Add accordion toggle behavior (same as Privacy tab)
    container.querySelectorAll(".privacy-category-header").forEach(header => {
        header.addEventListener("click", () => {
            const category = header.parentElement;
            category.classList.toggle("open");
            const toggle = header.querySelector(".privacy-category-toggle");
            toggle.textContent = category.classList.contains("open") ? "▲" : "▼";
        });
    });
}

function createQuickSetupCard(setting, isElevated) {
    const isOn = setting.current_state === true;
    const isOff = setting.current_state === false;
    const isUnknown = setting.current_state === null;

    const card = createElement("div", {
        className: `privacy-card ${isOn ? "active" : ""} ${setting.risk === "moderate" ? "risk-moderate" : ""} ${setting.risk === "risky" ? "risk-risky" : ""}`
    });

    if (setting.risk === "risky" || setting.risk === "moderate") {
        card.style.borderLeftColor = setting.risk === "risky" ? "var(--red)" : "var(--orange)";
    }

    // Toggle switch (same pattern as Options/Privacy tabs)
    const toggleLabel = createElement("label", { className: "wo-toggle" }, [
        createElement("input", {
            type: "checkbox",
            className: "wo-toggle-input",
            checked: isOn,
            disabled: isUnknown && setting.requires_admin && !isElevated,
            "aria-label": setting.name,
        }),
        createElement("span", { className: "wo-toggle-slider" })
    ]);

    const toggleInput = toggleLabel.querySelector("input");

    // Apply immediately on toggle change
    toggleInput.addEventListener("change", () => {
        const action = toggleInput.checked ? "apply" : "revert";
        toggleInput.disabled = true;

        fetch("/api/quicksetup/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: [setting.id], action })
        })
        .then(r => r.json())
        .then(result => {
            toggleInput.disabled = false;
            const r = result.results?.[setting.id];
            if (r?.success) {
                card.classList.toggle("active", toggleInput.checked);
                showToast(`${setting.name}: ${action === "apply" ? "Applied" : "Reverted"}`, "success");
            } else {
                toggleInput.checked = !toggleInput.checked; // Revert toggle
                showToast(`${setting.name}: ${r?.error || "Failed"}`, "error");
            }
        })
        .catch(() => {
            toggleInput.disabled = false;
            toggleInput.checked = !toggleInput.checked; // Revert toggle
            showToast(`${setting.name}: Network error`, "error");
        });
    });

    // Info section
    const info = createElement("div", { className: "privacy-card-info" }, [
        createElement("div", { className: "privacy-card-header" }, [
            createElement("span", { className: "privacy-card-name" }, [setting.name]),
            setting.recommended === "on" ? createElement("span", { className: "badge badge-recommended" }, ["Recommended"]) : null,
            setting.requires_admin ? createElement("span", { className: "badge badge-admin" }, ["Admin"]) : null,
            setting.reboot_required ? createElement("span", { className: "badge wo-badge-reboot" }, ["Reboot"]) : null,
            setting.risk === "moderate" ? createElement("span", { className: "badge wo-badge-mod" }, ["Moderate"]) : null,
            setting.risk === "risky" ? createElement("span", { className: "badge wo-badge-risk" }, ["Risky"]) : null,
        ].filter(Boolean)),
        createElement("div", { className: "privacy-card-desc" }, [setting.description]),
        setting.warning ? createElement("div", { className: "privacy-card-warning" }, [`⚠️ ${setting.warning}`]) : null,
        isUnknown && setting.requires_admin && !isElevated
            ? createElement("div", { className: "privacy-card-warning" }, ["Requires administrator privileges"])
            : null,
    ]);

    card.appendChild(toggleLabel);
    card.appendChild(info);

    return card;
}

// ── Initialize ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    loadApps();
    loadCatalog();
});