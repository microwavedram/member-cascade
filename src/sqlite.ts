import { Database } from "bun:sqlite"
import log from "npmlog"

export default class SQLite {
	private readonly db: Database
	private cache: Map<string, string> = new Map()


	constructor(source: string) {
		this.db = new Database(source, {
			create: true,
		})
	}

	async setup(): Promise<void> {
		log.info("SQLITE", "Initialising database")
		this.db.exec(
			"CREATE TABLE IF NOT EXISTS user_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT, role_id TEXT)"
		)
	}

	async createRole(source_id: string, role_id: string): Promise<void> {
		const query = this.db.prepare(
			"INSERT INTO user_roles (source_id, role_id) VALUES ($source_id, $role_id)"
		)

		query.run({
			$source_id: source_id,
			$role_id: role_id,
		})

		this.cache.set(source_id, role_id)
	}

    async getRoleFromUser(source_id: string): Promise<string | null> {
        if (this.cache.has(source_id)) {
            return this.cache.get(source_id) || null
        }

        const query = this.db.prepare("SELECT role_id FROM user_roles WHERE source_id = $source_id LIMIT 1")
        const result = query.get({ $source_id: source_id }) as { role_id: string } | undefined

        if (result) {
            this.cache.set(source_id, result.role_id)
            return result.role_id
        }

        return null
    }

    async getUserFromRole(role_id: string): Promise<string | null> {
        const query = this.db.prepare("SELECT source_id FROM user_roles WHERE role_id = $role_id LIMIT 1")
        const result = query.get({ $role_id: role_id }) as { source_id: string } | undefined

        return result?.source_id ?? null
    }
}
