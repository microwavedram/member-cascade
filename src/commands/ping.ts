import { CommandInteraction, MessageFlags, PermissionFlags, SlashCommandBuilder } from "discord.js"

export default {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("replys with pong!"),
    
    async execute(interaction: CommandInteraction) {
        await interaction.reply({
            content: "Pong",
            flags: MessageFlags.Ephemeral
        })
    }
}