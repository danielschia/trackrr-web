const API_BASE_URL = (window.TRACKRR_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'trackrr_access_token';

if (!API_BASE_URL) {
    throw new Error('TRACKRR_API_BASE_URL is not configured. Create a .env file and run node scripts/generate-config.js.');
}

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

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
            <header class="d-flex justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h1 class="h2 mb-1">${escapeHtml(dashboard.name)}</h1>
                    <p class="text-muted mb-0">${escapeHtml(dashboard.description || 'No description')}</p>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button type="button" class="btn btn-outline-secondary btn-sm" data-dashboard-edit-toggle>Edit dashboard</button>
                    <a href="dashboards.html" class="btn btn-outline-secondary btn-sm">Back to dashboards</a>
                </div>
            </header>

            <div class="collapse mt-3" id="dashboard-edit-form-wrapper">
                <form id="dashboard-edit-form" class="card card-body border shadow-sm">
                    <div class="mb-3">
                        <label class="form-label">Dashboard name</label>
                        <input type="text" name="name" class="form-control" value="${escapeHtml(dashboard.name)}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-control" rows="3">${escapeHtml(dashboard.description || '')}</textarea>
                    </div>
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-primary btn-sm">Save dashboard</button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-dashboard-edit-cancel>Cancel</button>
                    </div>
                </form>
            </div>
        `;

        const dashboardEditToggle = detailRoot.querySelector('[data-dashboard-edit-toggle]');
        const dashboardEditFormWrapper = detailRoot.querySelector('#dashboard-edit-form-wrapper');
        const dashboardEditForm = detailRoot.querySelector('#dashboard-edit-form');

        if (dashboardEditToggle && dashboardEditFormWrapper && dashboardEditForm) {
            dashboardEditToggle.addEventListener('click', () => {
                dashboardEditFormWrapper.classList.toggle('show');
            });

            const dashboardCancelButton = detailRoot.querySelector('[data-dashboard-edit-cancel]');
            if (dashboardCancelButton) {
                dashboardCancelButton.addEventListener('click', () => {
                    dashboardEditFormWrapper.classList.remove('show');
                });
            }

            dashboardEditForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const formData = new FormData(dashboardEditForm);
                const name = (formData.get('name') || '').toString().trim();
                const description = (formData.get('description') || '').toString().trim();

                if (!name) {
                    showFormMessage('#dashboard-detail-message', 'Dashboard name is required.', 'danger');
                    return;
                }

                try {
                    await apiFetch(`/dashboards/${dashboardId}`, {
                        method: 'PUT',
                        body: {
                            name,
                            description
                        }
                    });

                    dashboardEditFormWrapper.classList.remove('show');
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        }

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
                                    <h2 class="h5 mb-1">${escapeHtml(listItem.name)}</h2>
                                    <p class="small text-muted mb-0">${escapeHtml(listItem.description || 'No description')}</p>
                                </div>
                                <div class="d-flex gap-2">
                                    <button type="button" class="btn btn-sm btn-outline-secondary list-edit-toggle" data-list-id="${listItem.id}">Edit</button>
                                    <button class="btn btn-sm btn-outline-danger delete-list-btn" data-list-id="${listItem.id}">Delete</button>
                                </div>
                            </div>

                            <div class="list-edit-form collapse mb-3" id="list-edit-form-${listItem.id}">
                                <form class="list-edit-form-inner" data-list-id="${listItem.id}">
                                    <div class="mb-2">
                                        <input class="form-control form-control-sm" name="name" value="${escapeHtml(listItem.name)}" required>
                                    </div>
                                    <div class="mb-2">
                                        <textarea class="form-control form-control-sm" name="description" rows="2">${escapeHtml(listItem.description || '')}</textarea>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button type="submit" class="btn btn-sm btn-primary">Save</button>
                                        <button type="button" class="btn btn-sm btn-outline-secondary cancel-list-edit">Cancel</button>
                                    </div>
                                </form>
                            </div>

                            <div class="list-column__tasks mb-3">
                                ${tasks.length ? tasks.map((task) => `
                                    <div class="task-card card mb-2" data-task-id="${task.id}" draggable="true">
                                        <div class="card-body p-2 d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <strong class="d-block">${escapeHtml(task.title)}</strong>
                                                ${task.description ? `<small class="text-muted d-block">${escapeHtml(task.description)}</small>` : ''}
                                            </div>
                                            <div class="d-flex align-items-center gap-2">
                                                <button type="button" class="btn btn-link btn-sm text-secondary p-0 task-edit-toggle" data-task-id="${task.id}">Edit</button>
                                                <button type="button" class="btn btn-link btn-sm text-danger p-0 delete-task-btn" data-task-id="${task.id}">Delete</button>
                                            </div>
                                        </div>
                                        <div class="task-edit-form collapse px-2 pb-2" id="task-edit-form-${task.id}">
                                            <form class="task-edit-form-inner" data-task-id="${task.id}">
                                                <div class="mb-2">
                                                    <input class="form-control form-control-sm" name="title" value="${escapeHtml(task.title)}" required>
                                                </div>
                                                <div class="mb-2">
                                                    <textarea class="form-control form-control-sm" name="description" rows="2">${escapeHtml(task.description || '')}</textarea>
                                                </div>
                                                <div class="d-flex gap-2">
                                                    <button type="submit" class="btn btn-sm btn-primary">Save</button>
                                                    <button type="button" class="btn btn-sm btn-outline-secondary cancel-task-edit">Cancel</button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                `).join('') : '<p class="text-muted small mb-0">No tasks yet.</p>'}
                            </div>

                            <div class="task-form-wrapper collapse" id="task-form-${listItem.id}">
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

                            <button type="button" class="btn btn-sm btn-outline-primary add-task-toggle mt-2" data-target="task-form-${listItem.id}">Add task</button>
                        </div>
                    </article>
                `;
            }).join('');
        }

        document.querySelectorAll('.add-task-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const formWrapper = document.getElementById(targetId);
                if (formWrapper) {
                    formWrapper.classList.toggle('show');
                }
            });
        });

        document.querySelectorAll('.list-edit-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const listId = button.dataset.listId;
                const form = document.getElementById(`list-edit-form-${listId}`);
                if (form) {
                    form.classList.toggle('show');
                }
            });
        });

        document.querySelectorAll('.cancel-list-edit').forEach((button) => {
            button.addEventListener('click', () => {
                const form = button.closest('.list-edit-form');
                if (form) {
                    form.classList.remove('show');
                }
            });
        });

        document.querySelectorAll('.list-edit-form-inner').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const listId = form.dataset.listId;
                const formData = new FormData(form);
                const name = (formData.get('name') || '').toString().trim();
                const description = (formData.get('description') || '').toString().trim();

                if (!name) {
                    showFormMessage('#dashboard-detail-message', 'List name is required.', 'danger');
                    return;
                }

                try {
                    await apiFetch(`/lists/${listId}`, {
                        method: 'PUT',
                        body: {
                            name,
                            description
                        }
                    });

                    form.closest('.list-edit-form').classList.remove('show');
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });

        document.querySelectorAll('.task-edit-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const taskId = button.dataset.taskId;
                const form = document.getElementById(`task-edit-form-${taskId}`);
                if (form) {
                    form.classList.toggle('show');
                }
            });
        });

        document.querySelectorAll('.cancel-task-edit').forEach((button) => {
            button.addEventListener('click', () => {
                const form = button.closest('.task-edit-form');
                if (form) {
                    form.classList.remove('show');
                }
            });
        });

        document.querySelectorAll('.task-edit-form-inner').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const taskId = form.dataset.taskId;
                const formData = new FormData(form);
                const title = (formData.get('title') || '').toString().trim();
                const description = (formData.get('description') || '').toString().trim();

                if (!title) {
                    showFormMessage('#dashboard-detail-message', 'Task title is required.', 'danger');
                    return;
                }

                try {
                    await apiFetch(`/tasks/${taskId}`, {
                        method: 'PUT',
                        body: {
                            title,
                            description
                        }
                    });

                    form.closest('.task-edit-form').classList.remove('show');
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });

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
                    const wrapper = form.closest('.task-form-wrapper');
                    if (wrapper) {
                        wrapper.classList.remove('show');
                    }
                    await loadDashboardDetailPage();
                } catch (error) {
                    showFormMessage('#dashboard-detail-message', error.message, 'danger');
                }
            });
        });

        if (listForm && !listForm.dataset.submitBound) {
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
            listForm.dataset.submitBound = 'true';
        }
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
