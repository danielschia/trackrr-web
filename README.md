# Trackrr Web Frontend

Frontend for the Trackrr application. This project is a static web client that connects to the Trackrr API backend and handles authentication, dashboards, lists, and tasks through browser-based API calls.

## Stack

- HTML
- CSS
- JavaScript
- Bootstrap
- Fetch API

## Requirements

- A running Trackrr backend instance
- A browser for local testing

## Backend dependency

This frontend expects the backend API URL to be configured in a local environment file instead of being hardcoded in the source code.

The backend repository is:

- https://github.com/danielschia/trackrr-api

Make sure the backend is running before testing the frontend.

## Local configuration

Create a local `.env` file from the example and set your API URL there:

```env
TRACKRR_API_BASE_URL=YOUR_BASE_URL
```

Generate the browser config file before starting the app, adding your environment in there as well:

```
window.TRACKRR_API_BASE_URL = "YOUR_BASE_URL";
```

This writes the runtime value to `static/js/config.js` without hardcoding it in the application code.

## Local setup

1. Start the backend API:

```bash
cd /Users/danielschiavoni/projects/trackrr-api
source .venv/bin/activate
flask --app app run --host 0.0.0.0 --port 5000
```

2. Start the frontend static server:

```bash
cd /Users/danielschiavoni/projects/trackrr-web
node scripts/generate-config.js
python3 -m http.server 8000
```

3. Open the app in the browser:

```text
http://localhost:8000/login.html
```

## Application flow

- Sign up creates a user through the backend API
- Login gets a JWT access token
- The token is stored in browser localStorage
- Dashboards, lists, and tasks are loaded via API calls to the backend
- CRUD actions are performed with authenticated requests

## Files overview

- `index.html` — landing page
- `login.html` — login form
- `signup.html` — signup form
- `dashboards.html` — dashboard list page
- `dashboard.html` — dashboard detail and list/task management
- `static/js/app.js` — API client, auth flow, and page logic
- `static/js/drag_and_drop.js` — drag-and-drop task reordering logic
- `static/css/main.css` — frontend styles

## Notes

- The frontend uses browser localStorage to store the access token.
- CORS must be enabled on the backend for requests from the frontend origin.
- The app is intended for local development and is not a production deployment setup.

## Useful commands

```bash
cd /Users/danielschiavoni/projects/trackrr-web
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
