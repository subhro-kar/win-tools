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
    if (tabId === "tweaks") loadTweaks();
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
                label: "SSH Keys",
                found: syncData.ssh?.found,
                detail: syncData.ssh?.found
                    ? `${syncData.ssh.keyCount} key(s) in ${syncData.ssh.dir}`
                    : "No SSH keys found",
                count: syncData.ssh?.keyCount || 0,
            },
            {
                key: "git",
                label: "Git Config",
                found: syncData.git?.found,
                detail: syncData.git?.found
                    ? `Found: ${syncData.git.path}`
                    : "No .gitconfig found",
            },
            {
                key: "envVars",
                label: "Environment Variables",
                found: syncData.envVars?.found,
                detail: syncData.envVars?.found
                    ? `${syncData.envVars.count} user environment variables`
                    : "No user env vars found",
                count: syncData.envVars?.count || 0,
            },
            {
                key: "psProfile",
                label: "PowerShell Profile",
                found: syncData.psProfile?.found,
                detail: syncData.psProfile?.found
                    ? `Found: ${syncData.psProfile.path}`
                    : "No PowerShell profile found",
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
            },
            {
                key: "windowsTerminal",
                label: "Windows Terminal Settings",
                found: syncData.windowsTerminal?.found,
                detail: syncData.windowsTerminal?.found
                    ? `Found: ${syncData.windowsTerminal.path}`
                    : "Windows Terminal settings not found",
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
            { key: "ssh", label: "SSH Keys", pathKey: "dir" },
            { key: "git", label: "Git Config", pathKey: "path" },
            { key: "envVars", label: "Environment Variables", pathKey: null },
            { key: "psProfile", label: "PowerShell Profile", pathKey: "path" },
            { key: "gpg", label: "GPG Keys", pathKey: null },
            { key: "windowsTerminal", label: "Windows Terminal Settings", pathKey: "path" },
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
            if (def.key === "ssh") detailText = `${item.fileCount} file(s) in ${item.dir}`;
            else if (def.key === "envVars") detailText = `${item.count} environment variable(s)`;
            else if (def.key === "gpg") detailText = `${item.keyCount} secret key(s)`;
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

// ── Tweaks (Windows Settings) ────────────────────────────────────────

let tweaksData = null;

async function loadTweaks() {
    const el = document.getElementById("tweaks-content");
    const resultEl = document.getElementById("tweaks-result");
    resultEl.textContent = "";
    showLoading(el, "Scanning Windows settings...");

    try {
        const res = await fetch(`${API}/tweaks`);
        tweaksData = await res.json();
        renderTweaks(tweaksData);
    } catch (err) {
        el.textContent = "";
        el.appendChild(createElement("div", { className: "loading" }, [`Error: ${err.message}`]));
    }
}

function renderTweaks(data) {
    const el = document.getElementById("tweaks-content");
    el.textContent = "";

    const categoryIcons = {
        "Personalization": "🎨",
        "Privacy & Telemetry": "🔒",
        "Performance & Power": "⚡",
        "Security & Updates": "🛡️",
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
            const card = createElement("div", {
                className: `tweak-card${tweak.current_state === true ? " active" : ""}${tweak.script_only ? " script-only" : ""}`,
            });

            // Checkbox + info row
            const topRow = createElement("div", { className: "tweak-top" });
            const checkbox = createElement("input", {
                type: "checkbox",
                className: "tweak-checkbox",
                id: `tweak-${tweak.id}`,
                value: tweak.id,
            });
            checkbox.dataset.requiresAdmin = tweak.requires_admin ? "1" : "0";
            checkbox.dataset.scriptOnly = tweak.script_only ? "1" : "0";

            const info = createElement("div", { className: "tweak-info" });
            const nameRow = createElement("div", { className: "tweak-name-row" });
            const name = createElement("span", { className: "tweak-name" }, [tweak.name]);

            // Badges
            const badges = createElement("span", { className: "tweak-badges" });
            if (tweak.recommended === "on") {
                badges.appendChild(createElement("span", { className: "badge badge-recommended" }, ["Recommended"]));
            }
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

            // Current state indicator
            const stateRow = createElement("div", { className: "tweak-state" });
            if (tweak.current_state === true) {
                stateRow.appendChild(createElement("span", { className: "state-on" }, ["✓ Enabled"]));
            } else if (tweak.current_state === false) {
                stateRow.appendChild(createElement("span", { className: "state-off" }, ["✗ Disabled"]));
            } else {
                stateRow.appendChild(createElement("span", { className: "state-unknown" }, ["? Unknown"]));
            }
            if (tweak.current_value !== null && tweak.current_value !== undefined) {
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
}

async function applySelectedTweaks() {
    const btn = document.getElementById("btn-tweaks-apply");
    const resultEl = document.getElementById("tweaks-result");
    const selected = getSelectedTweakIds();

    if (selected.length === 0) {
        showToast("Select at least one tweak to apply", "info");
        return;
    }

    // Warn about admin tweaks
    const adminTweaks = selected.filter(id => {
        const cb = document.querySelector(`input[value="${id}"]`);
        return cb && cb.dataset.requiresAdmin === "1";
    });
    if (adminTweaks.length > 0) {
        // Check if we might be running as admin (not easy to check from browser)
        // Just show a note
        showToast(`${adminTweaks.length} tweak(s) require admin rights. If they fail, run WinTools as Administrator.`, "info");
    }

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

            // Refresh state
            setTimeout(() => loadTweaks(), 1000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "Apply Selected";
}

async function revertSelectedTweaks() {
    const btn = document.getElementById("btn-tweaks-revert");
    const resultEl = document.getElementById("tweaks-result");
    const selected = getSelectedTweakIds();

    if (selected.length === 0) {
        showToast("Select at least one tweak to revert", "info");
        return;
    }

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

            setTimeout(() => loadTweaks(), 1000);
        } else {
            showToast(`Error: ${data.error || "Unknown error"}`, "error");
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, "error");
    }

    btn.disabled = false;
    btn.textContent = "Revert Selected";
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
}

// ── Initialize ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    loadApps();
    loadCatalog();
});