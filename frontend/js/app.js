// AlgoRitual Application Frontend Controller

// Global App State
const state = {
    token: localStorage.getItem('algoToken') || null,
    user: JSON.parse(localStorage.getItem('algoUser')) || null,
    simulatedDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
    vaultFilter: 'all',
    heatmapYear: null,
    heatmapMonth: null,
    completedDates: []
};

// API Base URL (Relative path since backend hosts the frontend static folder)
const API_URL = window.location.origin;

// DOM Elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');

// Header Displays
const simulatedDateDisplay = document.getElementById('simulated-date-display');
const userStreakDisplay = document.getElementById('user-streak-display');
const userUsernameDisplay = document.getElementById('user-username-display');
const logoutBtn = document.getElementById('logout-btn');

// LeetCode Stats Elements
const statsTotalCompleted = document.getElementById('stats-total-completed');
const statsTotalPlanned = document.getElementById('stats-total-planned');
const statsEasyCompleted = document.getElementById('stats-easy-completed');
const statsEasyTotal = document.getElementById('stats-easy-total');
const statsEasyBar = document.getElementById('stats-easy-bar');
const statsMediumCompleted = document.getElementById('stats-medium-completed');
const statsMediumTotal = document.getElementById('stats-medium-total');
const statsMediumBar = document.getElementById('stats-medium-bar');
const statsHardCompleted = document.getElementById('stats-hard-completed');
const statsHardTotal = document.getElementById('stats-hard-total');
const statsHardBar = document.getElementById('stats-hard-bar');
const progressCircle = document.getElementById('leetcode-progress-circle');
const heatmapGrid = document.getElementById('heatmap-grid');

// Column Header Counts
const columnMustDoCount = document.getElementById('column-mustdo-count');
const columnTodoCount = document.getElementById('column-todo-count');
const columnRevisionCount = document.getElementById('column-revision-count');
const columnBacklogCount = document.getElementById('column-backlog-count');

// Column Lists
const listMustDo = document.getElementById('list-mustdo');
const listTodo = document.getElementById('list-todo');
const listRevision = document.getElementById('list-revision');
const listBacklog = document.getElementById('list-backlog');

// Import & Vault Drawers
const toggleImportBtn = document.getElementById('toggle-import-btn');
const closeImportBtn = document.getElementById('close-import-btn');
const importPlanDrawer = document.getElementById('import-plan-drawer');
const importStartDate = document.getElementById('import-start-date');
const importTextContent = document.getElementById('import-text-content');
const submitImportBtn = document.getElementById('submit-import-btn');

const toggleVaultBtn = document.getElementById('toggle-vault-btn');
const closeVaultBtn = document.getElementById('close-vault-btn');
const vaultDrawer = document.getElementById('vault-drawer');
const vaultTableBody = document.getElementById('vault-table-body');



// --- Helper Functions ---

// Fetch API Wrapper
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const config = {
        method,
        headers
    };
    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed.');
        }
        return data;
    } catch (err) {
        console.error(`Error requesting ${endpoint}:`, err);
        alert(err.message);
        throw err;
    }
}

// Format date to readable string (e.g. "Jun 13, 2026")
function formatDateString(dateStr) {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// add days utility
function addDays(dateStr, days) {
    const date = new Date(dateStr + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
}

// Clean display title to avoid duplicate platform tags and trailing delimiters
function cleanDisplayTitle(title, platform) {
    if (!title) return '';
    let clean = title.trim();
    
    // Remove platform if already in title (case insensitive)
    if (platform) {
        const escapedPlatform = platform.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const platformPattern = '\\s*[-\\s:|()\\\\\\[\\]]*\\b' + escapedPlatform + '\\b\\s*$';
        const platformRegex = new RegExp(platformPattern, 'i');
        clean = clean.replace(platformRegex, '');
    }
    
    // Strip trailing dashes, colons, brackets, spaces, and delimiters
    clean = clean.replace(/[-\s:|()\\\\\\[\\]]+$/, '').trim();
    
    // Replace multiple dashes or spaces inside
    clean = clean.replace(/\s*-\s*-\s*/g, ' - ');
    clean = clean.replace(/\s+/g, ' ');
    
    return clean;
}


// JSON study plan parser helper
function parseJsonPlan(data, type = 'todo') {
    const questions = [];
    const days = Array.isArray(data) ? data : [data];
    
    for (const dayObj of days) {
        const currentDay = parseInt(dayObj.day || dayObj.dayIndex || 1, 10);
        
        let tasks = [];
        if (type === 'todo') {
            tasks = dayObj.tasks || dayObj.questions || [];
        } else if (type === 'completed') {
            // Check completed/revisions specific fields in the JSON day object
            const revisionTasks = dayObj.revisions || dayObj.archive_revisions || dayObj.completed || dayObj.archive || [];
            
            // Also search in main tasks for any explicitly completed ones
            const mainTasks = dayObj.tasks || dayObj.questions || [];
            const completedMainTasks = mainTasks.filter(t => t.status === 'completed' || t.completed === true || !!t.isPQ);
            
            tasks = [...revisionTasks, ...completedMainTasks];
            
            // Fallback: If both lists are empty, but the user is pasting this JSON in the completed box,
            // we treat all tasks in the main list as completed questions
            if (tasks.length === 0 && mainTasks.length > 0) {
                tasks = mainTasks;
            }
        }
        
        if (!Array.isArray(tasks)) continue;
        
        for (const task of tasks) {
            const isCompletedTask = task.status === 'completed' || task.completed === true || !!task.isPQ;
            
            if (type === 'todo' && isCompletedTask) {
                continue;
            }
            
            const title = task.title || task.name || '';
            if (!title || title.length < 3) continue;
            
            const difficulty = task.difficulty || 'Easy';
            const platform = task.platform || 'LeetCode';
            
            let link = task.link || '';
            if (!link && task.leetcodeId && platform.toLowerCase() === 'leetcode') {
                const slug = title.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                link = `https://leetcode.com/problems/${slug}/`;
            } else if (!link && (platform.toLowerCase() === 'geeksforgeeks' || platform.toLowerCase() === 'gfg')) {
                const slug = title.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                link = `https://www.geeksforgeeks.org/problems/${slug}/`;
            }
            
            let concept = task.concept || task.category || '';
            if (!concept) {
                if (task.track === 'Track A' || task.track === 'track_a') {
                    concept = dayObj.track_a_topic || '';
                } else if (task.track === 'Track B' || task.track === 'track_b') {
                    concept = dayObj.track_b_topic || '';
                }
            }
            
            questions.push({
                title,
                difficulty,
                platform,
                link,
                concept: concept.trim(),
                dayIndex: currentDay
            });
        }
    }
    return questions;
}

// Smart Copy-Paste plan parser
function parsePlanText(text, type = 'todo') {
    // Check if input is valid JSON
    let parsedJson = null;
    try {
        const trimmed = text.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            parsedJson = JSON.parse(trimmed);
        }
    } catch (e) {
        // Fallback to text parsing
    }

    if (parsedJson) {
        return parseJsonPlan(parsedJson, type);
    }

    const lines = text.split('\n');
    const questions = [];
    let currentDay = 1;
    let inArchiveSection = false;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const lowerLine = line.toLowerCase();

        // Skip Phase header lines (e.g. Phase 2: Hierarchical Structures)
        if (lowerLine.includes('phase')) {
            continue;
        }

        // Detect Archive Revision section start
        if (lowerLine.includes('archive revision') || lowerLine.includes('do these') || lowerLine.includes('previous question')) {
            inArchiveSection = true;
            continue;
        }

        // Detect Day indicator to update currentDay
        const dayMatch = line.match(/(?:Day|day)\s*(\d+)/i);
        if (dayMatch) {
            currentDay = parseInt(dayMatch[1], 10);
            // Reset archive section flag when we hit a new day
            inArchiveSection = false;
        }

        // Clean checkbox prefix (e.g. [ ], [x], [X])
        const hasCheckbox = /^\[[\sXx\-\checkmark]*\]/.test(line);
        let cleanLine = line.replace(/^\[[\sXx\-\checkmark]*\]\s*/, '').trim();

        // Determine if this line belongs to the requested type (todo or completed)
        if (type === 'todo') {
            // In todo mode: skip if it's in the archive section or has a checkbox
            if (inArchiveSection || hasCheckbox) {
                continue;
            }
            // Skip section dividers or syllabus noise that doesn't contain content
            if (
                cleanLine.toLowerCase().startsWith('day') && 
                cleanLine.split(/\s+/).length < 5 && 
                !cleanLine.includes('-') && 
                !cleanLine.includes('—') && 
                !cleanLine.includes('#')
            ) {
                continue;
            }
        } else if (type === 'completed') {
            // In completed mode: keep only if it has a checkbox OR is in the archive section
            // and skip Track A/B headers
            if (!inArchiveSection && !hasCheckbox) {
                continue;
            }
            if (
                cleanLine.toLowerCase().startsWith('track a') ||
                cleanLine.toLowerCase().startsWith('track b') ||
                cleanLine.toLowerCase().startsWith('track c')
            ) {
                continue;
            }
        }

        // Skip generic header lines or very short lines
        if (cleanLine.length < 3) continue;

        // Skip lines that are just day headers (double safety check)
        const lowerClean = cleanLine.toLowerCase();
        if (lowerClean.startsWith('day') && cleanLine.split(/\s+/).length < 5 && !cleanLine.includes('-') && !cleanLine.includes('—') && !cleanLine.includes('#')) {
            continue;
        }

        // Clean the track prefix from the title (e.g., "Track A (DP): " or "Track B (Recursion): ")
        cleanLine = cleanLine.replace(/^Track\s+[A-Za-z]\s*(?:\([^)]+\))?\s*[:\-–—]\s*/i, '');

        // Extract concept/topic from brackets, parentheses, or trailing dash
        let concept = '';
        const bracketMatch = cleanLine.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
            concept = bracketMatch[1].trim();
        } else {
            const parenMatches = cleanLine.match(/\(([^)]+)\)/g);
            if (parenMatches) {
                for (const m of parenMatches) {
                    const inner = m.slice(1, -1).trim();
                    const lowerInner = inner.toLowerCase();
                    if (inner.match(/^#?\d+$/)) {
                        continue;
                    }
                    // Skip platform names as concepts
                    if (
                        lowerInner === 'leetcode' ||
                        lowerInner === 'gfg' ||
                        lowerInner === 'geeksforgeeks' ||
                        lowerInner === 'codeforces' ||
                        lowerInner === 'cf' ||
                        lowerInner === 'codechef'
                    ) {
                        continue;
                    }
                    if (!inner.startsWith('http') && !inner.includes('.') && !inner.includes('/')) {
                        concept = inner;
                        break;
                    }
                }
            }
        }
        if (!concept) {
            const parts = cleanLine.split(/[\-–—]/);
            if (parts.length >= 3) {
                const lastPart = parts[parts.length - 1].trim();
                if (lastPart.length < 20 && !lastPart.startsWith('http') && !lastPart.includes('/')) {
                    concept = lastPart;
                }
            }
        }

        // Extract difficulty
        let difficulty = 'Easy';
        if (cleanLine.match(/\b(medium|med|intermediate)\b/i)) {
            difficulty = 'Medium';
        } else if (cleanLine.match(/\b(hard|advanced|hrd)\b/i)) {
            difficulty = 'Hard';
        }

        // Extract link
        let link = '';
        const linkMatch = cleanLine.match(/(https?:\/\/[^\s\)]+)/i);
        if (linkMatch) {
            link = linkMatch[1];
        }

        // Extract platform
        let platform = 'LeetCode';
        if (cleanLine.match(/\b(geeksforgeeks|gfg)\b/i)) {
            platform = 'GeeksforGeeks';
        } else if (cleanLine.match(/\b(codeforces|cf)\b/i)) {
            platform = 'Codeforces';
        } else if (cleanLine.match(/\b(codechef)\b/i)) {
            platform = 'CodeChef';
        }

        // Extract clean title
        let title = cleanLine;
        title = title.replace(/^(?:day|Day)\s*\d+[:\-–—\s]*/, ''); // Remove Day label
        title = title.replace(/\(https?:\/\/[^\s\)]+\)/, ''); // Remove parenthesis link
        title = title.replace(/https?:\/\/[^\s]+/, ''); // Remove normal link
        title = title.replace(/\b(easy|medium|hard|med|intermediate|advanced|hrd|Easy|Medium|Hard)\b/i, ''); // Remove difficulty
        title = title.replace(/\b(leetcode|geeksforgeeks|gfg|codeforces|cf|codechef)\b/i, ''); // Remove platform name
        title = title.replace(/\(#?\d+\)/g, ''); // Remove LeetCode number tags (e.g. (#1))
        title = title.replace(/\[#?\d+\]/g, ''); // Remove LeetCode number tags in brackets (e.g. [#1])
        
        // Remove concept block if it was in brackets or parentheses
        if (concept) {
            title = title.replace(new RegExp(`\\[\\s*${concept.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\]`), '');
            title = title.replace(new RegExp(`\\(\\s*${concept.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\)`), '');
            title = title.replace(new RegExp(`-\\s*${concept.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`), '');
        }

        title = title.replace(/\s*-\s*-\s*/g, ' - '); // Normalize double dashes
        title = title.replace(/\s+/g, ' '); // Normalize spaces
        title = title.replace(/^[\s\-\*\#\d\.\:\(\)]+/, ''); // Strip leading bullet markers
        title = title.trim();
        
        // Clean trailing spaces, hyphens, colons, stars, en-dashes, and em-dashes
        title = title.replace(/[\s\-–—\:\*]+$/, '');
        // Clean empty trailing parentheses/brackets only (to protect signatures like atoi() or Pow(x,n))
        title = title.replace(/\(\s*\)$/, '');
        title = title.replace(/\[\s*\]$/, '');
        title = title.trim();

        if (title.length < 3 || title.toLowerCase().startsWith('day') || title.toLowerCase().startsWith('topic')) {
            continue;
        }

        questions.push({
            title,
            difficulty,
            platform,
            link,
            concept,
            dayIndex: currentDay
        });
    }
    return questions;
}

// --- Navigation & Routing ---

function showAuth() {
    state.token = null;
    state.user = null;
    state.heatmapYear = null;
    state.heatmapMonth = null;
    state.completedDates = [];
    localStorage.removeItem('algoToken');
    localStorage.removeItem('algoUser');
    
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
}

function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    
    // Set Profile Displays
    userUsernameDisplay.textContent = state.user.username;
    if (simulatedDateDisplay) {
        simulatedDateDisplay.textContent = formatDateString(state.simulatedDate);
    }
    
    renderDashboard();
}

// SVG Circle Progress calculation
function setProgressRing(completed, total) {
    const radius = progressCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    if (total === 0) {
        progressCircle.style.strokeDashoffset = circumference;
        return;
    }
    
    const offset = circumference - (completed / total) * circumference;
    progressCircle.style.strokeDashoffset = offset;
}

// Render Heatmap grid of dates for the current active heatmap year and month
function renderHeatmap() {
    heatmapGrid.innerHTML = '';
    
    // Fallback if not initialized
    if (state.heatmapYear === null || state.heatmapMonth === null) {
        const simDate = new Date(state.simulatedDate + 'T12:00:00Z');
        state.heatmapYear = simDate.getUTCFullYear();
        state.heatmapMonth = simDate.getUTCMonth();
    }
    
    const year = state.heatmapYear;
    const month = state.heatmapMonth;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthNameDisplay = document.getElementById('heatmap-month-name');
    if (monthNameDisplay) {
        monthNameDisplay.textContent = `${monthNames[month]} ${year}`;
    }
    
    // First day and last day of the active month
    const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
    
    const totalDays = lastDay.getUTCDate();
    const startingDayOfWeek = firstDay.getUTCDay(); // 0 = Sunday, 1 = Monday...
    
    // Start calendar grid on Sunday. startingDayOfWeek is already 0 (Sun) to 6 (Sat)
    const paddingCount = startingDayOfWeek;
    
    for (let i = 0; i < paddingCount; i++) {
        const pad = document.createElement('div');
        pad.className = 'calendar-day hidden-pad';
        pad.style.visibility = 'hidden';
        heatmapGrid.appendChild(pad);
    }
    
    // Loop through calendar days
    for (let day = 1; day <= totalDays; day++) {
        const dayDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
        const dayStr = dayDate.toISOString().split('T')[0];
        
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.title = formatDateString(dayStr);
        
        // Mark if current simulated day
        if (dayStr === state.simulatedDate) {
            dayCell.classList.add('today-highlight');
        }
        
        // Count how many times this date appears in completed dates list
        const solvedCount = state.completedDates.filter(d => d === dayStr).length;
        
        dayCell.innerHTML = `<span class="calendar-day-number">${day}</span>`;
        
        if (solvedCount > 0) {
            const dot = document.createElement('div');
            dot.className = 'calendar-day-dot';
            dayCell.appendChild(dot);
            dayCell.title += `: Completed ${solvedCount} problems`;
        }
        
        heatmapGrid.appendChild(dayCell);
    }
}

// Render card items into lists
function createQuestionCard(q, isRevision = false, revisionId = null) {
    const card = document.createElement('div');
    card.className = `question-card`;
    
    const diffTagClass = `tag-${q.difficulty.toLowerCase()}`;
    const cleanLink = q.link 
        ? `<a href="${q.link}" target="_blank" rel="noopener" class="card-solve-link">Solve Problem</a>` 
        : `<span></span>`;
    
    const displayTitle = cleanDisplayTitle(q.title, q.platform);
    const pqBadge = q.isPQ 
        ? `<span class="pq-badge" style="background: rgba(139, 92, 246, 0.12); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.25); font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 700; margin-right: 4px; display: inline-block; vertical-align: middle;">PQ</span>` 
        : '';
    
    card.innerHTML = `
        <div class="card-top">
            <h4 class="card-title">${pqBadge}${displayTitle} - ${q.platform}</h4>
            <span class="card-difficulty-tag ${diffTagClass}">${q.difficulty.toUpperCase()}</span>
        </div>
        <div class="card-bottom">
            ${cleanLink}
            <div class="card-actions">
                ${isRevision 
                    ? `<button class="btn-complete complete-rev-btn" data-id="${revisionId}">Mark Revised</button>`
                    : `<button class="btn-complete complete-q-btn" data-id="${q._id}">Mark Completed</button>`
                }
            </div>
        </div>
    `;
    return card;
}

// Fetch dashboard metrics and draw UI components
async function renderDashboard() {
    try {
        const data = await fetchAPI(`/api/dsa/dashboard?simulatedDate=${state.simulatedDate}`);
        
        // 1. Update Profile Stats & Streak
        userStreakDisplay.textContent = data.userProfile.streak;
        
        const leet = data.leetcodeStats;
        statsTotalCompleted.textContent = leet.total.completed;
        statsTotalPlanned.textContent = leet.total.total;
        
        // Set SVG circle progress offset
        setProgressRing(leet.total.completed, leet.total.total);
        
        // Easy bar
        statsEasyCompleted.textContent = leet.easy.completed;
        statsEasyTotal.textContent = leet.easy.total;
        const easyPct = leet.easy.total > 0 ? (leet.easy.completed / leet.easy.total) * 100 : 0;
        statsEasyBar.style.width = `${easyPct}%`;
        
        // Medium bar
        statsMediumCompleted.textContent = leet.medium.completed;
        statsMediumTotal.textContent = leet.medium.total;
        const medPct = leet.medium.total > 0 ? (leet.medium.completed / leet.medium.total) * 100 : 0;
        statsMediumBar.style.width = `${medPct}%`;
        
        // Hard bar
        statsHardCompleted.textContent = leet.hard.completed;
        statsHardTotal.textContent = leet.hard.total;
        const hardPct = leet.hard.total > 0 ? (leet.hard.completed / leet.hard.total) * 100 : 0;
        statsHardBar.style.width = `${hardPct}%`;
        
        // Heatmap Calendar
        state.completedDates = data.userProfile.completedDates || [];
        if (state.heatmapYear === null || state.heatmapMonth === null) {
            const simDate = new Date(state.simulatedDate + 'T12:00:00Z');
            state.heatmapYear = simDate.getUTCFullYear();
            state.heatmapMonth = simDate.getUTCMonth();
        }
        renderHeatmap();
        
        // Render Active Plans & Progress (Visible only when multiple plans are active)
        const activePlansSection = document.querySelector('.active-plans-section');
        const activePlansList = document.getElementById('active-plans-list');
        const leetcodeLayout = document.querySelector('.leetcode-layout');
        
        if (activePlansSection && activePlansList && leetcodeLayout) {
            // Filter targets for active plans (i.e. pending > 0)
            const activePlans = data.targets.filter(t => t.pending > 0);
            
            if (activePlans.length > 1) {
                // Show section and change grid layout
                activePlansSection.classList.remove('hidden');
                leetcodeLayout.classList.add('has-multiple-plans');
                
                activePlansList.innerHTML = '';
                activePlans.forEach((plan, index) => {
                    const pct = plan.total > 0 ? (plan.completed / plan.total) * 100 : 0;
                    const fillClass = `fill-plan-${index % 2}`;
                    
                    const item = document.createElement('div');
                    item.className = 'plan-progress-container';
                    item.innerHTML = `
                        <div class="plan-label">
                            <span class="plan-title">${plan.name}</span>
                            <span class="plan-ratio">${plan.completed}/${plan.total} (${Math.round(pct)}%)</span>
                        </div>
                        <div class="plan-progress-track">
                            <div class="plan-progress-fill ${fillClass}" style="width: ${pct}%"></div>
                        </div>
                    `;
                    activePlansList.appendChild(item);
                });
            } else {
                // Hide section and restore grid layout
                activePlansSection.classList.add('hidden');
                leetcodeLayout.classList.remove('has-multiple-plans');
                activePlansList.innerHTML = '';
            }
        }
        
        // 2. Set Column Header Counts
        if (columnMustDoCount) columnMustDoCount.textContent = data.counts.mustDo;
        if (columnTodoCount) columnTodoCount.textContent = data.counts.todayTasks;
        if (columnRevisionCount) columnRevisionCount.textContent = data.counts.todayRevisions;
        if (columnBacklogCount) columnBacklogCount.textContent = data.counts.revisionBacklog || 0;
        
        // 3. Render Lists
        const lists = data.lists;
        
        // Render Must Do
        listMustDo.innerHTML = '';
        if (lists.mustDo.length === 0) {
            listMustDo.innerHTML = '<div class="empty-state">No overdue questions. Good job!</div>';
        } else {
            lists.mustDo.forEach(q => {
                listMustDo.appendChild(createQuestionCard(q, false));
            });
        }
        
        // Render Today's Tasks
        listTodo.innerHTML = '';
        if (lists.todayTasks.length === 0) {
            listTodo.innerHTML = '<div class="empty-state">No questions scheduled for today. Import a plan!</div>';
        } else {
            lists.todayTasks.forEach(q => {
                listTodo.appendChild(createQuestionCard(q, false));
            });
        }
        
        // Render Revisions
        listRevision.innerHTML = '';
        if (lists.todayRevisions.length === 0) {
            listRevision.innerHTML = '<div class="empty-state">No revisions due today. Solve questions first!</div>';
        } else {
            lists.todayRevisions.forEach(rev => {
                listRevision.appendChild(createQuestionCard(rev.question, true, rev._id));
            });
        }

        // Render Revision Backlog
        listBacklog.innerHTML = '';
        if (!lists.revisionBacklog || lists.revisionBacklog.length === 0) {
            listBacklog.innerHTML = '<div class="empty-state">No backlog revisions. You\'re fully caught up!</div>';
        } else {
            lists.revisionBacklog.forEach(rev => {
                listBacklog.appendChild(createQuestionCard(rev.question, true, rev._id));
            });
        }
        
        // Bind Actions dynamically to list buttons
        bindListActionListeners();
        
    } catch (err) {
        console.error('Failed to render dashboard:', err);
    }
}

// Actions inside lists (checking questions off list)
function bindListActionListeners() {
    // Complete Question Buttons
    document.querySelectorAll('.complete-q-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const questionId = e.currentTarget.getAttribute('data-id');
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                await fetchAPI('/api/dsa/complete-question', 'POST', {
                    questionId,
                    simulatedDate: state.simulatedDate
                });
                
                renderDashboard();
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = 'Mark Completed <i class="fa-solid fa-check"></i>';
            }
        });
    });

    // Complete Revision Buttons
    document.querySelectorAll('.complete-rev-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const revisionId = e.currentTarget.getAttribute('data-id');
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                await fetchAPI('/api/dsa/complete-revision', 'POST', {
                    revisionId,
                    simulatedDate: state.simulatedDate
                });
                
                renderDashboard();
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = 'Mark Revised <i class="fa-solid fa-check"></i>';
            }
        });
    });
}

// Fetch all questions and display inside Revision Vault drawer
async function populateRevisionVault() {
    try {
        const data = await fetchAPI('/api/dsa/all-questions');
        vaultTableBody.innerHTML = '';
        
        let displayedQuestions = data.questions;
        if (state.vaultFilter === 'completed') {
            displayedQuestions = data.questions.filter(q => q.status === 'completed');
        }

        if (displayedQuestions.length === 0) {
            const msg = state.vaultFilter === 'completed' 
                ? 'No completed questions yet. Solve tasks to complete them!' 
                : 'No questions imported yet.';
            vaultTableBody.innerHTML = `<tr><td colspan="4" class="text-center">${msg}</td></tr>`;
            return;
        }

        // Loop and draw
        displayedQuestions.forEach(q => {
            // Find active revisions for this question to calculate active spaced repetition interval
            const activeRevs = data.revisions.filter(r => r.questionTitle === q.title);
            let intervalText = '-';
            let nextDueText = 'Solved State';

            if (q.status === 'pending') {
                nextDueText = `Scheduled: ${formatDateString(q.scheduledDate)}`;
            } else if (activeRevs.length > 0) {
                // Find pending or latest revision record
                const pendingRev = activeRevs.find(r => r.status === 'pending');
                if (pendingRev) {
                    intervalText = `${pendingRev.interval}d`;
                    nextDueText = formatDateString(pendingRev.nextRevisionDate);
                } else {
                    const completedRevs = activeRevs.filter(r => r.status === 'completed');
                    if (completedRevs.length > 0) {
                        const latest = completedRevs.reduce((prev, current) => (prev.interval > current.interval) ? prev : current);
                        intervalText = `${latest.interval}d (Done)`;
                        nextDueText = 'Revision complete';
                    }
                }
            }

            const displayTitle = cleanDisplayTitle(q.title, q.platform);
            const pqBadge = q.isPQ 
                ? `<span class="pq-badge" style="background: rgba(139, 92, 246, 0.12); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.25); font-size: 8px; padding: 1px 3px; border-radius: 3px; font-weight: 700; margin-right: 4px; display: inline-block; vertical-align: middle;">PQ</span>` 
                : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${pqBadge}${displayTitle}</strong><br><small class="text-muted">${q.platform}</small></td>
                <td><span class="card-difficulty-tag tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
                <td>${intervalText}</td>
                <td>${nextDueText}</td>
            `;
            vaultTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to populate Revision Vault:', err);
    }
}

// --- Event Listeners & Initializations ---

// Auth Form toggling
showSignup.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

showLogin.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

// Submit Login Form
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const data = await fetchAPI('/api/auth/login', 'POST', { email, password });
        state.token = data.token;
        state.user = data.user;
        
        localStorage.setItem('algoToken', data.token);
        localStorage.setItem('algoUser', JSON.stringify(data.user));
        
        loginForm.reset();
        showDashboard();
    } catch (err) {
        // Handled in fetch wrapper
    }
});

// Submit Register Form
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        await fetchAPI('/api/auth/register', 'POST', { username, email, password });
        alert('Registration successful! Please login.');
        registerForm.reset();
        showLogin.click();
    } catch (err) {
        // Handled in fetch wrapper
    }
});

// Logout Button
logoutBtn.addEventListener('click', () => {
    showAuth();
});

// Drawer Toggles
toggleImportBtn.addEventListener('click', () => {
    // Initialize start date input to today
    importStartDate.value = state.simulatedDate;
    
    importPlanDrawer.classList.toggle('hidden');
    vaultDrawer.classList.add('hidden'); // Close vault
});

closeImportBtn.addEventListener('click', () => {
    importPlanDrawer.classList.add('hidden');
});

toggleVaultBtn.addEventListener('click', () => {
    vaultDrawer.classList.toggle('hidden');
    importPlanDrawer.classList.add('hidden'); // Close import
    
    if (!vaultDrawer.classList.contains('hidden')) {
        state.vaultFilter = 'all';
        const vaultTabAll = document.getElementById('vault-tab-all');
        const vaultTabCompleted = document.getElementById('vault-tab-completed');
        if (vaultTabAll && vaultTabCompleted) {
            vaultTabAll.classList.add('active');
            vaultTabCompleted.classList.remove('active');
        }
        populateRevisionVault();
    }
});

closeVaultBtn.addEventListener('click', () => {
    vaultDrawer.classList.add('hidden');
});

// Vault Drawer Tab switching listeners
const vaultTabAll = document.getElementById('vault-tab-all');
const vaultTabCompleted = document.getElementById('vault-tab-completed');
if (vaultTabAll && vaultTabCompleted) {
    vaultTabAll.addEventListener('click', () => {
        state.vaultFilter = 'all';
        vaultTabAll.classList.add('active');
        vaultTabCompleted.classList.remove('active');
        populateRevisionVault();
    });
    
    vaultTabCompleted.addEventListener('click', () => {
        state.vaultFilter = 'completed';
        vaultTabCompleted.classList.add('active');
        vaultTabAll.classList.remove('active');
        populateRevisionVault();
    });
}

// Sidebar Solved Problems link click listener
const sidebarSolvedBtn = document.getElementById('sidebar-solved-btn');
if (sidebarSolvedBtn) {
    sidebarSolvedBtn.addEventListener('click', () => {
        vaultDrawer.classList.remove('hidden');
        importPlanDrawer.classList.add('hidden'); // Close import
        
        state.vaultFilter = 'completed';
        const vaultTabAll = document.getElementById('vault-tab-all');
        const vaultTabCompleted = document.getElementById('vault-tab-completed');
        if (vaultTabAll && vaultTabCompleted) {
            vaultTabCompleted.classList.add('active');
            vaultTabAll.classList.remove('active');
        }
        populateRevisionVault();
    });
}

// Parse & Import Plan Trigger
submitImportBtn.addEventListener('submit', (e) => e.preventDefault());
submitImportBtn.addEventListener('click', async () => {
    const targetName = document.getElementById('import-target-name').value.trim();
    const rawText = importTextContent.value.trim();
    const rawCompletedText = document.getElementById('import-completed-text-content').value.trim();
    const startDate = importStartDate.value;
    
    if (!targetName) {
        alert('Please enter a target / topic name (e.g. DP, Graph).');
        return;
    }

    if (!rawText && !rawCompletedText) {
        alert('Please paste at least some to-do questions or previously solved questions.');
        return;
    }
    
    let questions = [];
    if (rawText) {
        questions = parsePlanText(rawText, 'todo');
        if (questions.length === 0) {
            alert('We could not find any questions to parse in the To-Do list. Verify format (e.g. Day 1: Title - Easy).');
            return;
        }
    }

    let completedQuestions = [];
    if (rawCompletedText) {
        completedQuestions = parsePlanText(rawCompletedText, 'completed');
        if (completedQuestions.length === 0) {
            alert('We could not find any questions to parse in the Previously Solved list. Verify format (e.g. Title - Easy).');
            return;
        }
    }
    
    try {
        submitImportBtn.disabled = true;
        submitImportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
        
        const res = await fetchAPI('/api/dsa/import-plan', 'POST', {
            questions,
            completedQuestions,
            startDate,
            targetName
        });
        
        alert(`Successfully imported plan! Todo questions: ${res.todoCount}, Completed questions: ${res.completedCount}`);
        
        // Reset inputs
        document.getElementById('import-target-name').value = '';
        importTextContent.value = '';
        document.getElementById('import-completed-text-content').value = '';
        importPlanDrawer.classList.add('hidden');
        renderDashboard();
    } catch (err) {
        // Handled in fetch wrapper
    } finally {
        submitImportBtn.disabled = false;
        submitImportBtn.innerHTML = 'Parse & Import Plan';
    }
});

// Reset Active Plan & All Progress Helper
async function triggerResetPlan(btnElement) {
    const password = prompt('WARNING: This will permanently delete all questions, active plans, revisions, and streaks. Enter your password to confirm reset:');
    
    if (password === null) {
        return; // Aborted
    }
    
    const trimmedPass = password.trim();
    if (!trimmedPass) {
        alert('Password cannot be empty.');
        return;
    }

    try {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

        const res = await fetchAPI('/api/dsa/reset-plan', 'POST', { password: trimmedPass });
        alert(res.message);

        // Close Drawer & Reset Inputs
        importPlanDrawer.classList.add('hidden');
        document.getElementById('import-target-name').value = '';
        importTextContent.value = '';
        document.getElementById('import-completed-text-content').value = '';

        // Re-render dashboard (now empty)
        renderDashboard();
    } catch (err) {
        // Error is already alerted in fetchAPI wrapper
    } finally {
        btnElement.disabled = false;
        btnElement.innerHTML = btnElement.id === 'reset-plan-btn' 
            ? 'Reset Active Plan & Progress' 
            : '<i class="fa-solid fa-trash-can"></i> <span>Reset Plan</span>';
    }
}

const resetPlanBtn = document.getElementById('reset-plan-btn');
if (resetPlanBtn) {
    resetPlanBtn.addEventListener('click', () => triggerResetPlan(resetPlanBtn));
}

const sidebarResetBtn = document.getElementById('sidebar-reset-btn');
if (sidebarResetBtn) {
    sidebarResetBtn.addEventListener('click', () => triggerResetPlan(sidebarResetBtn));
}

// Sidebar Overlay toggle event listeners
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const dashboardSidebar = document.querySelector('.dashboard-sidebar');

if (sidebarToggleBtn && dashboardSidebar && sidebarBackdrop) {
    sidebarToggleBtn.addEventListener('click', () => {
        dashboardSidebar.classList.add('open');
        sidebarBackdrop.classList.remove('hidden');
    });
}

if (sidebarCloseBtn && dashboardSidebar && sidebarBackdrop) {
    sidebarCloseBtn.addEventListener('click', () => {
        dashboardSidebar.classList.remove('open');
        sidebarBackdrop.classList.add('hidden');
    });
}

if (sidebarBackdrop && dashboardSidebar) {
    sidebarBackdrop.addEventListener('click', () => {
        dashboardSidebar.classList.remove('open');
        sidebarBackdrop.classList.add('hidden');
    });
}

// Close sidebar menu overlay when clicking any item
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        if (dashboardSidebar) dashboardSidebar.classList.remove('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    });
});

// Heatmap Navigation Click Listeners
const heatmapPrevBtn = document.getElementById('heatmap-prev-btn');
const heatmapNextBtn = document.getElementById('heatmap-next-btn');

if (heatmapPrevBtn && heatmapNextBtn) {
    heatmapPrevBtn.addEventListener('click', () => {
        if (state.heatmapMonth === 0) {
            state.heatmapMonth = 11;
            state.heatmapYear -= 1;
        } else {
            state.heatmapMonth -= 1;
        }
        renderHeatmap();
    });

    heatmapNextBtn.addEventListener('click', () => {
        if (state.heatmapMonth === 11) {
            state.heatmapMonth = 0;
            state.heatmapYear += 1;
        } else {
            state.heatmapMonth += 1;
        }
        renderHeatmap();
    });
}

// Gemini Prompt Builder Logic
function updateGeneratedPrompt() {
    const role = document.getElementById('prompt-role').value.trim() || 'SDE Intern';
    const topic = document.getElementById('prompt-topic').value.trim() || 'DP';
    const days = document.getElementById('prompt-days').value.trim() || '10';
    const level = document.getElementById('prompt-level').value;
    const playlist = document.getElementById('prompt-link').value.trim();
    
    let playlistSentence = '';
    if (playlist) {
        playlistSentence = `I am following this YouTube playlist/reference for my study: ${playlist}. Please align the plan with this resource.`;
    }
    
    const promptText = `I am preparing for a ${role} role. I have ${days} days to study. Please create a day-by-day DSA study plan for the topic: "${topic}".
Focus on ${level} difficulty questions.
${playlistSentence}

You MUST format the output exactly as shown below so my parser can read it. Do not include markdown tables, only print the raw lines:

Day 1: Two Sum - Easy (LeetCode)
Day 2: Valid Anagram - Easy (LeetCode)
Day 3: Group Anagrams - Medium (LeetCode)

Ensure each line contains the Day number, Question name, Difficulty, and Platform (LeetCode, GeeksforGeeks, Codeforces, etc.) in this exact format.`;

    const textarea = document.getElementById('prompt-output-textarea');
    if (textarea) {
        textarea.value = promptText;
    }
}

// Bind input event listeners to prompt elements
const promptRoleInput = document.getElementById('prompt-role');
const promptTopicInput = document.getElementById('prompt-topic');
const promptDaysInput = document.getElementById('prompt-days');
const promptLevelSelect = document.getElementById('prompt-level');
const promptLinkInput = document.getElementById('prompt-link');
const copyPromptBtn = document.getElementById('copy-prompt-btn');

if (promptRoleInput) {
    [promptRoleInput, promptTopicInput, promptDaysInput, promptLevelSelect, promptLinkInput].forEach(el => {
        if (el) {
            el.addEventListener('input', updateGeneratedPrompt);
            el.addEventListener('change', updateGeneratedPrompt);
        }
    });
    updateGeneratedPrompt();
}

if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', () => {
        const textarea = document.getElementById('prompt-output-textarea');
        if (textarea) {
            textarea.select();
            textarea.setSelectionRange(0, 99999); // Mobile
            
            try {
                navigator.clipboard.writeText(textarea.value);
                copyPromptBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    copyPromptBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Prompt';
                }, 2000);
            } catch (err) {
                alert('Failed to copy. Please select and copy manually.');
            }
        }
    });
}

// App Initiation
window.addEventListener('DOMContentLoaded', () => {
    if (state.token && state.user) {
        showDashboard();
    } else {
        showAuth();
    }
});
