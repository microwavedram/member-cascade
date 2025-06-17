import { CommandInteraction } from "discord.js"

export interface DiscordCommand {
    data: any
    execute: (interaction: CommandInteraction) => void
}

export interface IConfig {
    mode: "DEV" | "PROD"
    dev_guild: string
    client_id: string

    developer_id: string
}