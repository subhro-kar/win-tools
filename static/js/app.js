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

    // Icon container
    const iconContainer = createElement("div", { className: "app-icon" });

    // Try loading app icon in priority: custom icon path > Google Favicon > letter fallback
    if (item.icon && item.icon !== "") {
        // Custom local icon (future use)
        const img = createElement("img", { src: item.icon, alt: item.name });
        img.onerror = function() {
            this.style.display = "none";
            this.parentNode.textContent = getInitials(item.name);
            this.parentNode.style.color = getCategoryColor(item.category);
        };
        iconContainer.appendChild(img);
    } else if (item.link && item.link !== "") {
        // Google Favicons API — same approach as Chris Titus WinUtil
        const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(item.link)}`;
        const img = createElement("img", { src: faviconUrl, alt: item.name });
        img.onerror = function() {
            // Favicon failed — fall back to colored letter
            this.style.display = "none";
            this.parentNode.textContent = getInitials(item.name);
            this.parentNode.style.color = getCategoryColor(item.category);
        };
        iconContainer.appendChild(img);
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

// ── Initialize ────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    loadApps();
    loadCatalog();
});