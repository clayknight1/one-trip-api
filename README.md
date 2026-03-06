# Shopping List API

A full-stack shopping list management API built with Hono, TypeScript, and Drizzle ORM. Supports multi-user collaboration with store-based access control.

## Tech Stack

- **Framework:** Hono
- **Language:** TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT-based (in development)

## Features

- Create, update, and delete shopping list items
- Store-based organization with group access control
- Multi-user collaboration with permission checking
- RESTful API design with proper HTTP status codes

## API Endpoints

```
POST   /item       - Create new item
PATCH  /item/:id   - Update item (mark as purchased)
DELETE /item/:id   - Delete item
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## Database Schema

- **stores** - Shopping locations/stores
- **listItems** - Individual shopping list items
- **groupMembers** - User access control for stores

---

**Notes:** This is a work-in-progress project demonstrating clean API architecture, service layer patterns, and database relationships.
