# Users REST API

A CRUD API built with Node.js, Express, and SQLite.

## Requirements

- Node.js 20 or newer
- Postman (for running the included collection)

## Configure and start

```sh
npm install
npm start
```

The app is available at `http://localhost:3000`, with the JSON API at `http://localhost:3000/api/users`. It creates `database/users.sqlite` automatically on first launch and adds the example records from `data/users.json` once. No separate database server or `.env` file is required. To change the port or database file, copy `.env.example` to `.env` and edit `PORT` or `DB_PATH`.

The SQLite schema is in `database/schema.sql`. The database file is local application data and is excluded from Git.

## Web interface

Open `http://localhost:3000` to manage users. The page supports creating, editing, searching, and deleting records, and displays the current records as JSON. The interface uses the same API as the Postman collection.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/users` | Create a user with `name` and `email`; returns `201` |
| GET | `/api/users` | Return all users |
| GET | `/api/users/:id` | Return one user |
| PUT | `/api/users/:id` | Replace a user's `name` and `email` |
| DELETE | `/api/users/:id` | Delete a user; returns `204` |

Names are trimmed and limited to 100 characters. Email addresses are validated and limited to 254 characters. Invalid input returns `400`, missing users return `404`, duplicate emails return `409`, and unexpected server errors return a generic `500` response.

## Postman

Import `postman/Users API.postman_collection.json` into Postman. Start the API and run the collection in order; its requests exercise create, list, fetch-by-ID, update, delete, not-found, and invalid-input behavior. The collection uses `http://localhost:3000` by default.

## Automated tests

```sh
npm test
```

The automated HTTP tests use an in-memory database, so they do not require a separate database server.
