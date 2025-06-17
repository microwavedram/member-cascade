import { Client, ClientOptions } from "discord.js"
import SQLite from "./sqlite"

export default class ExtendedClient extends Client {
    sqlite: SQLite

    constructor(options: ClientOptions, sqlite: SQLite) {
        super(options)

        this.sqlite = sqlite
    }
}