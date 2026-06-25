/* ═══════════════════════════════════════════════════════
   InternAI — Frontend Application
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──
  const state = {
    user: null,
    token: localStorage.getItem('internai_token') || null,
    internships: [],
    pagination: { page: 1, limit: 18, total: 0, totalPages: 0 },
    currentView: 'dashboard',
    currentSource: 'all',
    isLoading: false,
    isScraping: false
  };

  // ── DOM Cache ──
  const $ = (id) => document.getElementById(id);
  const el = {
    // Navbar
    navDashboard: $('navDashboard'),
    navProfile: $('navProfile'),
    navAuthBtn: $('navAuthBtn'),
    navAvatar: $('navAvatar'),
    navAvatarWrapper: $('navAvatarWrapper'),
    navBrandLink: $('navBrandLink'),
    // Profile dropdown
    avatarDropdown: $('avatarDropdown'),
    dropdownAvatar: $('dropdownAvatar'),
    dropdownName: $('dropdownName'),
    dropdownEmail: $('dropdownEmail'),
    dropdownViewProfile: $('dropdownViewProfile'),
    dropdownSettings: $('dropdownSettings'),
    dropdownLogout: $('dropdownLogout'),
    // Hero
    scrapeBtn: $('scrapeBtn'),
    heroAuthBtn: $('heroAuthBtn'),
    // Stats
    statTotal: $('statTotal'),
    statAvgScore: $('statAvgScore'),
    statRemote: $('statRemote'),
    statToday: $('statToday'),
    // Dashboard
    searchInput: $('searchInput'),
    sourcePills: $('sourcePills'),
    filterSelect: $('filterSelect'),
    sortSelect: $('sortSelect'),
    loadingSkeleton: $('loadingSkeleton'),
    emptyState: $('emptyState'),
    internshipGrid: $('internshipGrid'),
    pagination: $('pagination'),
    dashboardView: $('dashboardView'),
    // Profile
    profileView: $('profileView'),
    profileAvatar: $('profileAvatar'),
    profileName: $('profileName'),
    profileEmail: $('profileEmail'),
    profileAppCount: $('profileAppCount'),
    profileJoinDate: $('profileJoinDate'),
    applicationList: $('applicationList'),
    emptyApplications: $('emptyApplications'),
    // Auth Modal
    authModal: $('authModal'),
    modalClose: $('modalClose'),
    modalTitle: $('modalTitle'),
    modalSubtitle: $('modalSubtitle'),
    loginTab: $('loginTab'),
    registerTab: $('registerTab'),
    authError: $('authError'),
    authForm: $('authForm'),
    nameGroup: $('nameGroup'),
    authName: $('authName'),
    authEmail: $('authEmail'),
    authPassword: $('authPassword'),
    authSubmit: $('authSubmit'),
    // Toast
    toastContainer: $('toastContainer')
  };

  // ── Toast System ──
  function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── API Helper ──
  async function api(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  // ── Auth ──
  function openAuthModal(tab = 'login') {
    setAuthTab(tab);
    el.authModal.classList.add('active');
    el.authError.classList.remove('visible');
    el.authForm.reset();
    setTimeout(() => el.authEmail.focus(), 350);
  }

  function closeAuthModal() {
    el.authModal.classList.remove('active');
  }

  function setAuthTab(tab) {
    if (tab === 'register') {
      el.loginTab.classList.remove('active');
      el.registerTab.classList.add('active');
      el.nameGroup.style.display = 'block';
      el.authSubmit.textContent = 'Create Account';
      el.modalTitle.textContent = 'Create Account';
      el.modalSubtitle.textContent = 'Start tracking your internship journey';
    } else {
      el.registerTab.classList.remove('active');
      el.loginTab.classList.add('active');
      el.nameGroup.style.display = 'none';
      el.authSubmit.textContent = 'Sign In';
      el.modalTitle.textContent = 'Welcome Back';
      el.modalSubtitle.textContent = 'Sign in to track your applications';
    }
    el.authError.classList.remove('visible');
  }

  async function handleAuth(e) {
    e.preventDefault();
    const isRegister = el.registerTab.classList.contains('active');
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;
    const name = el.authName.value.trim();

    if (isRegister && !name) {
      showAuthError('Please enter your name.');
      return;
    }

    el.authSubmit.disabled = true;
    el.authSubmit.textContent = isRegister ? 'Creating...' : 'Signing in...';

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { name, email, password } : { email, password };
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('internai_token', data.token);

      closeAuthModal();
      updateAuthUI();
      showToast(data.message || 'Welcome!', 'success');
      refreshDashboard();
    } catch (err) {
      showAuthError(err.message);
    } finally {
      el.authSubmit.disabled = false;
      el.authSubmit.textContent = isRegister ? 'Create Account' : 'Sign In';
    }
  }

  function showAuthError(msg) {
    el.authError.textContent = msg;
    el.authError.classList.add('visible');
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('internai_token');
    updateAuthUI();
    switchView('dashboard');
    showToast('Signed out successfully.', 'info');
    refreshDashboard();
  }

  async function checkAuth() {
    if (!state.token) return;
    try {
      const data = await api('/api/auth/me');
      state.user = data.user;
      updateAuthUI();
    } catch (err) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('internai_token');
    }
  }

  // ── Profile Dropdown ──

  /** Open the dropdown (idempotent). */
  function openDropdown() {
    el.avatarDropdown.classList.add('open');
    el.navAvatar.setAttribute('aria-expanded', 'true');
  }

  /** Close the dropdown (idempotent). */
  function closeDropdown() {
    el.avatarDropdown.classList.remove('open');
    el.navAvatar.setAttribute('aria-expanded', 'false');
  }

  /** Toggle open/closed — handles rapid clicks safely. */
  function toggleDropdown() {
    if (el.avatarDropdown.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function updateAuthUI() {
    if (state.user) {
      // Hide Sign-In button, show avatar wrapper
      el.navAuthBtn.style.display = 'none';
      el.navAvatarWrapper.style.display = 'flex';
      el.navProfile.style.display = 'inline-flex';

      // Set avatar letter + color in both the nav button and the dropdown header
      const initial = (state.user.name || 'U').charAt(0).toUpperCase();
      const color = state.user.avatar_color || '#7c3aed';
      el.navAvatar.textContent = initial;
      el.navAvatar.style.backgroundColor = color;
      el.dropdownAvatar.textContent = initial;
      el.dropdownAvatar.style.backgroundColor = color;

      // Populate dropdown user info
      el.dropdownName.textContent = state.user.name || 'User';
      el.dropdownEmail.textContent = state.user.email || '';

      el.heroAuthBtn.textContent = 'My Applications';
      el.heroAuthBtn.onclick = () => switchView('profile');
    } else {
      el.navAuthBtn.style.display = 'inline-flex';
      el.navAvatarWrapper.style.display = 'none';
      el.navProfile.style.display = 'none';
      closeDropdown();
      el.heroAuthBtn.textContent = 'Create Free Account';
      el.heroAuthBtn.onclick = () => openAuthModal('register');
    }
  }

  // ── Views ──
  function switchView(view) {
    state.currentView = view;
    // Update nav
    document.querySelectorAll('.nav-link[data-view]').forEach(btn => btn.classList.remove('nav-link--active'));
    const activeNav = document.querySelector(`.nav-link[data-view="${view}"]`);
    if (activeNav) activeNav.classList.add('nav-link--active');

    if (view === 'dashboard') {
      el.dashboardView.style.display = 'block';
      el.profileView.classList.remove('active');
      document.querySelector('.hero').style.display = 'block';
      el.statsSection = $('statsSection');
      if (el.statsSection) el.statsSection.style.display = 'block';
    } else if (view === 'profile') {
      if (!state.user) { openAuthModal('login'); return; }
      el.dashboardView.style.display = 'none';
      el.profileView.classList.add('active');
      document.querySelector('.hero').style.display = 'none';
      $('statsSection').style.display = 'none';
      loadProfile();
    }
  }

  // ── Profile ──
  async function loadProfile() {
    if (!state.user) return;
    el.profileAvatar.style.backgroundColor = state.user.avatar_color || '#7c3aed';
    el.profileAvatar.textContent = (state.user.name || 'U').charAt(0).toUpperCase();
    el.profileName.textContent = state.user.name || 'User';
    el.profileEmail.textContent = state.user.email || '';

    if (state.user.created_at) {
      el.profileJoinDate.textContent = new Date(state.user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }

    try {
      const data = await api('/api/applications');
      const apps = data.applications || [];
      el.profileAppCount.textContent = apps.length;

      el.applicationList.innerHTML = '';
      if (apps.length === 0) {
        el.emptyApplications.style.display = 'block';
        el.applicationList.appendChild(el.emptyApplications);
        return;
      }

      el.emptyApplications.style.display = 'none';
      apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'application-card';
        const appliedDate = app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const applyUrl = app.apply_link || app.link || '#';

        card.innerHTML = `
          <div class="app-status-dot"></div>
          <div class="app-info">
            <h4>${escapeHtml(app.title || 'Internship')}</h4>
            <p>${escapeHtml(app.company || '')} · ${escapeHtml(app.location || '')} · ${escapeHtml(app.source || '')}</p>
          </div>
          <div class="app-date">${appliedDate}</div>
          <div class="app-actions">
            <a href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply Now ↗</a>
            <button data-remove-id="${app.id}" title="Remove">✕</button>
          </div>
        `;
        el.applicationList.appendChild(card);
      });

      // Remove buttons
      el.applicationList.querySelectorAll('[data-remove-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const internshipId = btn.getAttribute('data-remove-id');
          try {
            await api(`/api/applications/${internshipId}`, { method: 'DELETE' });
            showToast('Application removed.', 'info');
            loadProfile();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  }

  // ── Internships ──
  async function fetchStats() {
    try {
      const stats = await api('/api/stats');
      animateCounter(el.statTotal, stats.total || 0);
      animateCounter(el.statAvgScore, Math.round(stats.avgScore || 0));
      animateCounter(el.statRemote, stats.remoteCount || 0);
      animateCounter(el.statToday, stats.todayCount || 0);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  function animateCounter(element, target) {
    const start = parseInt(element.textContent) || 0;
    if (start === target) return;
    const duration = 800;
    const startTime = performance.now();
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  async function fetchInternships() {
    state.isLoading = true;
    el.loadingSkeleton.style.display = 'grid';
    el.internshipGrid.innerHTML = '';
    el.emptyState.classList.add('hidden');
    el.pagination.classList.add('hidden');

    try {
      const params = new URLSearchParams({
        page: state.pagination.page,
        limit: state.pagination.limit,
        sort: el.sortSelect.value
      });

      const search = el.searchInput.value.trim();
      if (search) params.set('search', search);

      const filter = el.filterSelect.value;
      if (filter === 'remote') params.set('location', 'remote');
      if (filter === 'high-score') params.set('min_score', '60');

      if (state.currentSource !== 'all') params.set('source', state.currentSource);

      const data = await api(`/api/internships?${params.toString()}`);
      state.internships = data.internships || [];
      state.pagination = data.pagination || state.pagination;

      renderInternships();
      renderPagination();
    } catch (err) {
      console.error('Failed to fetch internships:', err);
      showToast('Failed to load internships.', 'error');
    } finally {
      state.isLoading = false;
      el.loadingSkeleton.style.display = 'none';
    }
  }

  function getScoreClass(score) {
    if (score > 60) return 'card-score--high';
    if (score >= 30) return 'card-score--mid';
    return 'card-score--low';
  }

  function getSourceClass(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('aicte')) return 'card-source-tag--aicte';
    if (s.includes('naukri')) return 'card-source-tag--naukri';
    return 'card-source-tag--internshala';
  }

  function getSourceLabel(source) {
    const s = (source || '').toLowerCase();
    if (s.includes('aicte')) return '🏛 AICTE';
    if (s.includes('naukri')) return '💼 Naukri';
    return '🎓 Internshala';
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderInternships() {
    el.internshipGrid.innerHTML = '';

    if (!state.internships.length) {
      el.emptyState.classList.remove('hidden');
      return;
    }

    el.emptyState.classList.add('hidden');

    state.internships.forEach((intern, index) => {
      const card = document.createElement('article');
      card.className = 'internship-card';
      card.style.transitionDelay = `${index * 50}ms`;

      const score = Number(intern.score || 0);
      const isRemote = Number(intern.is_remote) === 1;
      const hasApplied = intern.has_applied;
      const applyUrl = intern.apply_link || intern.link || '#';

      let trackBtnHtml = '';
      if (state.user) {
        if (hasApplied) {
          trackBtnHtml = `<button class="btn-apply btn-apply--tracked" data-tracked="${intern.id}" title="Tracked">✓ Tracked</button>`;
        } else {
          trackBtnHtml = `<button class="btn-apply btn-apply--track" data-track="${intern.id}" title="Track Application">☆ Track</button>`;
        }
      }

      card.innerHTML = `
        <span class="card-source-tag ${getSourceClass(intern.source)}">${getSourceLabel(intern.source)}</span>
        <span class="card-score ${getScoreClass(score)}">${score}/100</span>
        <h3 class="card-title">${escapeHtml(intern.title)}</h3>
        <p class="card-company">${escapeHtml(intern.company)}</p>
        <div class="card-meta">
          <div class="card-meta-item"><span class="meta-icon">💰</span> ${escapeHtml(intern.stipend || 'Not specified')}</div>
          <div class="card-meta-item"><span class="meta-icon">📍</span> <span class="location-badge ${isRemote ? 'remote' : ''}">${escapeHtml(intern.location || 'Not specified')}</span></div>
          ${intern.duration ? `<div class="card-meta-item"><span class="meta-icon">⏱</span> ${escapeHtml(intern.duration)}</div>` : ''}
          <div class="card-meta-item"><span class="meta-icon">📅</span> ${formatDate(intern.date_scraped)}</div>
        </div>
        <div class="card-footer">
          <a class="btn-apply btn-apply--primary" href="${escapeHtml(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply Now ↗</a>
          ${trackBtnHtml}
        </div>
      `;

      el.internshipGrid.appendChild(card);

      // Animate in with IntersectionObserver
      requestAnimationFrame(() => {
        setTimeout(() => card.classList.add('visible'), 50 + index * 50);
      });
    });

    // Card mouse tracking for radial hover effect
    el.internshipGrid.querySelectorAll('.internship-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    });

    // Track buttons
    el.internshipGrid.querySelectorAll('[data-track]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-track');
        try {
          await api(`/api/applications/${id}`, { method: 'POST', body: JSON.stringify({}) });
          btn.className = 'btn-apply btn-apply--tracked';
          btn.innerHTML = '✓ Tracked';
          btn.removeAttribute('data-track');
          btn.setAttribute('data-tracked', id);
          showToast('Application tracked!', 'success');
        } catch (err) {
          if (err.message.includes('Authentication')) {
            openAuthModal('login');
          } else {
            showToast(err.message, 'error');
          }
        }
      });
    });

    // Untrack buttons
    el.internshipGrid.querySelectorAll('[data-tracked]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-tracked');
        try {
          await api(`/api/applications/${id}`, { method: 'DELETE' });
          btn.className = 'btn-apply btn-apply--track';
          btn.innerHTML = '☆ Track';
          btn.removeAttribute('data-tracked');
          btn.setAttribute('data-track', id);
          showToast('Application untracked.', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // ── Pagination ──
  function renderPagination() {
    const { page, totalPages, total } = state.pagination;
    if (totalPages <= 1) {
      el.pagination.classList.add('hidden');
      return;
    }

    el.pagination.classList.remove('hidden');
    el.pagination.innerHTML = '';

    // Previous
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => goToPage(page - 1));
    el.pagination.appendChild(prevBtn);

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    if (startPage > 1) {
      addPageBtn(1);
      if (startPage > 2) addEllipsis();
    }

    for (let i = startPage; i <= endPage; i++) addPageBtn(i);

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) addEllipsis();
      addPageBtn(totalPages);
    }

    // Info
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `${total} total`;
    el.pagination.appendChild(info);

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = page >= totalPages;
    nextBtn.addEventListener('click', () => goToPage(page + 1));
    el.pagination.appendChild(nextBtn);

    function addPageBtn(num) {
      const btn = document.createElement('button');
      btn.className = `pagination-btn ${num === page ? 'active' : ''}`;
      btn.textContent = num;
      btn.addEventListener('click', () => goToPage(num));
      el.pagination.appendChild(btn);
    }

    function addEllipsis() {
      const span = document.createElement('span');
      span.className = 'pagination-info';
      span.textContent = '…';
      el.pagination.appendChild(span);
    }
  }

  function goToPage(page) {
    state.pagination.page = page;
    fetchInternships();
    window.scrollTo({ top: el.internshipGrid.offsetTop - 100, behavior: 'smooth' });
  }

  // ── Scrape ──
  async function triggerScrape() {
    if (state.isScraping) return;
    state.isScraping = true;

    el.scrapeBtn.classList.add('loading');
    el.scrapeBtn.disabled = true;
    el.scrapeBtn.querySelector('.btn-label').textContent = 'Scraping...';

    try {
      const result = await api('/api/scrape', { method: 'POST' });
      showToast(result.message || `Found ${result.count} internships!`, 'success');
      await refreshDashboard();
    } catch (err) {
      showToast(err.message || 'Scrape failed.', 'error');
    } finally {
      state.isScraping = false;
      el.scrapeBtn.classList.remove('loading');
      el.scrapeBtn.disabled = false;
      el.scrapeBtn.querySelector('.btn-label').textContent = 'Scrape All Sources';
    }
  }

  async function refreshDashboard() {
    await Promise.all([fetchStats(), fetchInternships()]);
  }

  // ── Scroll Reveal ──
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // ── Search Debounce ──
  let searchTimeout;
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.pagination.page = 1;
      fetchInternships();
    }, 350);
  }

  // ── Event Listeners ──
  function initListeners() {
    // Nav
    el.navDashboard.addEventListener('click', () => switchView('dashboard'));
    el.navProfile.addEventListener('click', () => switchView('profile'));
    el.navBrandLink.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
    el.navAuthBtn.addEventListener('click', () => openAuthModal('login'));

    // ── Profile Dropdown ──

    // Toggle dropdown when the avatar button is clicked
    el.navAvatar.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent the document listener from closing it immediately
      toggleDropdown();
    });

    // "View Profile" menu item
    el.dropdownViewProfile.addEventListener('click', () => {
      closeDropdown();
      switchView('profile');
    });

    // "Settings" menu item — placeholder toast for now
    el.dropdownSettings.addEventListener('click', () => {
      closeDropdown();
      showToast('Settings coming soon!', 'info');
    });

    // "Logout" menu item
    el.dropdownLogout.addEventListener('click', () => {
      closeDropdown();
      logout();
    });

    // Close when clicking anywhere outside the wrapper
    document.addEventListener('click', (e) => {
      if (!el.navAvatarWrapper.contains(e.target)) {
        closeDropdown();
      }
    }, true); // capture phase so it fires before inner handlers

    // Hero
    el.scrapeBtn.addEventListener('click', triggerScrape);
    el.heroAuthBtn.addEventListener('click', () => {
      if (state.user) switchView('profile');
      else openAuthModal('register');
    });

    // Auth modal
    el.modalClose.addEventListener('click', closeAuthModal);
    el.authModal.addEventListener('click', (e) => { if (e.target === el.authModal) closeAuthModal(); });
    el.loginTab.addEventListener('click', () => setAuthTab('login'));
    el.registerTab.addEventListener('click', () => setAuthTab('register'));
    el.authForm.addEventListener('submit', handleAuth);

    // Search / filter / sort
    el.searchInput.addEventListener('input', handleSearch);
    el.filterSelect.addEventListener('change', () => { state.pagination.page = 1; fetchInternships(); });
    el.sortSelect.addEventListener('change', () => { state.pagination.page = 1; fetchInternships(); });

    // Source pills
    el.sourcePills.addEventListener('click', (e) => {
      const pill = e.target.closest('.source-pill');
      if (!pill) return;
      el.sourcePills.querySelectorAll('.source-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.currentSource = pill.getAttribute('data-source');
      state.pagination.page = 1;
      fetchInternships();
    });

    // Keyboard — Escape closes auth modal OR dropdown (whichever is open)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.avatarDropdown.classList.contains('open')) {
          closeDropdown();
          el.navAvatar.focus(); // return focus to trigger for accessibility
        } else {
          closeAuthModal();
        }
      }
    });
  }

  // ── Init ──
  async function init() {
    initListeners();
    initScrollReveal();
    updateAuthUI();
    await checkAuth();
    await refreshDashboard();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
