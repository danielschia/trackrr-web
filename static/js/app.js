const API_BASE_URL = window.TRACKRR_API_BASE_URL || 'http://127.0.0.1:5000';
const TOKEN_STORAGE_KEY = 'trackrr_access_token';

function getStoredToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

function setStoredToken(token) {
    if (!token) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function isAuthenticated() {
    return Boolean(getStoredToken());
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

function renderAuthLinks() {
    const logoutButton = document.querySelector('[data-logout-button]');
    if (!logoutButton) return;

    if (isAuthenticated()) {
        logoutButton.hidden = false;
    } else {
        logoutButton.hidden = true;
    }
}

async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getStoredToken();

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const requestOptions = {
        ...options,
        headers
    };

    if (options.body && !(options.body instanceof FormData)) {
        requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
    const rawText = await response.text();
    const data = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
        const message = data && (data.error || data.message) ? data.error || data.message : 'Request failed';
        throw new Error(message);
    }

    return data;
}

function showFormMessage(selector, message, type = 'danger') {
    const target = document.querySelector(selector);
    if (!target) return;

    target.textContent = message;
    target.className = `alert alert-${type} mt-3`;
    target.hidden = !message;
}

async function handleAuthSubmit(event, endpoint, successPage, formSelector) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const result = await apiFetch(endpoint, {
            method: 'POST',
            body: payload
        });

        const token = result && result.access_token;
        if (!token) {
            throw new Error('No access token received from the API.');
        }

        setStoredToken(token);
        window.location.href = successPage;
    } catch (error) {
        showFormMessage(formSelector, error.message || 'Authentication failed.', 'danger');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function logout() {
    setStoredToken('');
    window.location.href = 'login.html';
}

async function loadDashboardsPage() {
    if (!isAuthenticated()) {
        redirectToLogin();
        return;
    }

    const list = document.querySelector('#dashboard-list');
    const form = document.querySelector('#dashboard-form');
    if (!list && !form) return;

    try {
        const dashboards = await apiFetch('/dashboards');

        if (list) {
            if (!dashboards.length) {
                list.innerHTML = '<div class="col-12"><div class="alert alert-light">No dashboards yet. Create one to get started.</div></div>';
            } else {
                list.innerHTML = dashboards.map((dashboard) => `
                    <div class="col-12 col-md-6 col-lg-4">
                        <a href="dashboard.html?id=${dashboard.id}" class="text-decoration-none text-dark">
                            <div class="card card-hover mb-3 p-3 h-100 shadow-sm">
                                <h2 class="h4 mb-2">${dashboard.name}</h2>
                                <p class="text-muted mb-0">${dashboard.description || 'No description'}</p>
                            </div>
                        </a>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        if (list) {
            list.innerHTML = `<div class="col-12"><div class="alert alert-danger">${error.message}</div></div>`;
        }
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const name = (formData.get('name') || '').toString().trim();
            const description = (formData.get('description') || '').toString().trim();

            if (!name) {
                showFormMessage('#dashboard-form-message', 'Dashboard name is required.', 'danger');
                return;
            }

            try {
                await apiFetch('/dashboards', {
                    method: 'POST',
                    body: {
                        name,
                        description
                    }
                });

                form.reset();
                showFormMessage('#dashboard-form-message', 'Dashboard created successfully.', 'success');
                await loadDashboardsPage();
            } catch (error) {
                showFormMessage('#dashboard-form-message', error.message, 'danger');
            }
        });
    }
}

async function loadDashboardDetailPage() {
    if (!isAuthenticated()) {
        redirectToLogin();
        return;
    }

    const dashboardId = new URLSearchParams(window.location.search).get('id');
    const detailRoot = document.querySelector('#dashboard-detail');
    const listContainer = document.querySelector('#list-container');
    const listForm = document.querySelector('#list-form');

    if (!dashboardId || !detailRoot) {
        return;
    }

    try {
        const dashboard = await apiFetch(`/dashboards/${dashboardId}`);

        detailRoot.innerHTML = `
            <header class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 class="h2 mb-1">${dashboard.name}</h1>
                    <p class="text-muted mb-0">${dashboard.description || 'No description'}</p>
                </div>
                <a href="dashboards.html" class="btn btn-outline-secondary">Back to dashboards</a>
            </header>
        `;

        const lists = Array.isArray(dashboard.lists) ? dashboard.lists : [];

        if (!lists.length) {
            listContainer.innerHTML = '<div class="alert alert-light">This dashboard has no lists yet.</div>';
        } else {
            listContainer.innerHTML = lists.map((listItem) => {
                const tasks = Array.isArray(listItem.tasks) ? listItem.tasks : [];
                return `
                    <article class="list-column card shadow-sm" data-list-id="${listItem.id}">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start mb-3 gap-2">
                                <div>
                                    <h2 class="h5 mb-1">${listItem.name}</h2>
                                    <p class="small text-muted mb-0">${listItem.description || 'No description'}</p>
                                </div>
                                <button class="btn btn-sm btn-outline-danger delete-list-btn" data-list-id="${listItem.id}">Delete</button>
                            </div>

                            <div class="list-column__tasks mb-3">
                                ${tasks.length ? tasks.map((task) => `
                                    <div class="task-card card mb-2" data-task-id="${task.id}" draggable="true">
                                        <div class="card-body p-2 d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <strong class="d-block">${task.title}</strong>
                                                ${task.description ? `<small class="text-muted d-block">${task.description}</small>` : ''}
                                            </div>
                                            <button type="button" class="btn btn-link btn-sm text-danger p-0 delete-task-btn" data-task-id="${task.id}">Delete</button>
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-muted small mb-0">No tasks yet.</p>'}
                            </div>

                            <form class="task-form" data-list-id="${listItem.id}">
                                <div class="mb-2">
                                    <input class="form-control form-control-sm" name="title" placeholder="Task title" required>
                                </div>
                                <div class="mb-2">
                                    <textarea class="form-control form-control-sm" name="description" rows="2" placeholder="Description"></textarea>
                                </div>
                                <button type="submit" class="btn btn-sm btn-primary">Add task</button>
                            </form>
                        </div>
                    </article>
                `;
            }).join('');
        }

        if (listForm) {
            listForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const formData = new FormData(listForm);
                const name = (formData.get('name') || '').toString().trim();
                const description = (formData.get('description') || '').toString().trim();

                if (!name) {
                    showFormMessage('#list-form-message', 'List name is required.', 'danger');
                    return;
                }

                try {
                    await apiFetch('/lists', {
                        method: 'POST',
                        body: {
                            dashboard_id: Number(dashboardId),
                            name,
                            description
                        }
                    });

                    listForm.reset();
                    showFormMessage('#list-form-message', 'List created successfully.', 'success');
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#list-form-message', error.message, 'danger');
                }
            });
        }

        document.querySelectorAll('.delete-list-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const listId = button.dataset.listId;
                try {
                    await apiFetch(`/lists/${listId}`, { method: 'DELETE' });
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });

        document.querySelectorAll('.delete-task-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const taskId = button.dataset.taskId;
                try {
                    await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });

        document.querySelectorAll('.task-form').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const formData = new FormData(form);
                const title = (formData.get('title') || '').toString().trim();
                const description = (formData.get('description') || '').toString().trim();
                const listId = Number(form.dataset.listId);

                if (!title) {
                    showFormMessage('#dashboard-detail-message', 'Task title is required.', 'danger');
                    return;
                }

                try {
                    await apiFetch('/tasks', {
                        method: 'POST',
                        body: {
                            title,
                            description,
                            dashboard_id: Number(dashboardId),
                            list_id: listId,
                            position: 1
                        }
                    });

                    form.reset();
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });
    } catch (error) {
        if (detailRoot) {
            detailRoot.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderAuthLinks();

    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => handleAuthSubmit(event, '/login', 'dashboards.html', '#login-form-message'));
    }

    const signupForm = document.querySelector('#signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', (event) => handleAuthSubmit(event, '/signup', 'dashboards.html', '#signup-form-message'));
    }

    const logoutButton = document.querySelector('[data-logout-button]');
    if (logoutButton) {
        logoutButton.addEventListener('click', (event) => {
            event.preventDefault();
            logout();
        });
    }

    if (document.body.dataset.page === 'dashboards') {
        loadDashboardsPage();
    }

    if (document.body.dataset.page === 'dashboard-detail') {
        loadDashboardDetailPage();
    }
});
