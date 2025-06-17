import { Client, TextChannel, Collection, REST, Routes, EmbedBuilder, ActivityType, PresenceUpdateStatus, Invite } from "discord.js"
import dotenv from "dotenv"
import path from "path"
import fs from "fs"
import { DiscordCommand } from "./types"

import { Config } from "./config"
import SQLite from "./sqlite"
import ExtendedClient from "./extended_client"

dotenv.config()

const Commands: Map<string, DiscordCommand> = new Map()

interface InviteCacheData {
	uses: number
	inviterTag: string | null
    inviterId: string | null
}

async function uploadCommands() {
    const rest = new REST().setToken(process.env.TOKEN as string)

    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'))

    const command_jsons: string[] = []
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file)
        const command = require(filePath).default

        command_jsons.push(command.data.toJSON())
        Commands.set(command.data.name, command)
    }

    try {
        console.log(`Started refreshing ${command_jsons.length} application (/) commands.`);

		const data = await rest.put(
			Config.mode == "DEV" ?
                Routes.applicationGuildCommands(Config.client_id, Config.dev_guild) :
                Routes.applicationCommands(Config.client_id),
			{ body: command_jsons },
		) as any[]

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error)
    }
}

async function main() {
    const discord_client = new ExtendedClient({
        intents: ["Guilds", "GuildMembers", "GuildInvites"],
        presence: {
            activities: [
                {
                    name: "for interations.",
                    type: ActivityType.Watching
                }
            ]
        }
    }, new SQLite("db.sqlite"))

    await discord_client.sqlite.setup()

    await uploadCommands()

    discord_client.on("interactionCreate", async interaction => {
        if (!interaction.isChatInputCommand()) return

        const command = Commands.get(interaction.commandName)

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`)
            return
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error)
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `There was an error while executing this command! Please either check your not being an absolute bafoon or if your convinced its really bad, send a screenshot to <@${Config.developer_id}>`, ephemeral: true });
            } else {
                await interaction.reply({ content: `There was an error while executing this command! Please either check your not being an absolute bafoon or if your convinced its really bad, send a screenshot to <@${Config.developer_id}>`, ephemeral: true });
            }
        }
    })

    const invitesCache = new Map<string, Map<string, InviteCacheData>>()

    discord_client.on("ready", async () => {
        console.log(`Discord bot logged in as ${discord_client.user?.username}`)
        
        for (const guild of discord_client.guilds.cache.values()) {
		const invites = await guild.invites.fetch()
		const inviteUses = new Map<string, InviteCacheData>()
		invites.forEach(invite => {
			inviteUses.set(invite.code, {
				uses: invite.uses ?? 0,
				inviterTag: invite.inviter?.tag ?? null,
				inviterId: invite.inviterId
			})
		})
		invitesCache.set(guild.id, inviteUses)
	}
    })

    discord_client.on('guildMemberAdd', async member => {
        try {
            const newInvites = await member.guild.invites.fetch()
            const previousUses = invitesCache.get(member.guild.id) || new Map()

            let usedInviteCode: string | null = null
            let inviterTag: string | null = null
            let inviterId: string | null = null

            for (const [code, invite] of newInvites.entries()) {
                const oldData = previousUses.get(code)
                const oldUses = oldData?.uses ?? 0
                const newUses = invite.uses ?? 0

                if (newUses > oldUses) {
                    usedInviteCode = code
                    inviterTag = invite.inviter?.tag ?? null
                    inviterId = invite.inviterId
                    break
                }
            }

            if (!usedInviteCode) {
                for (const [code, oldData] of previousUses.entries()) {
                    if (!newInvites.has(code)) {
                        usedInviteCode = code
                        inviterTag = oldData.inviterTag
                        inviterId = oldData.inviterId
                        break
                    }
                }
            }

            const updatedUses = new Map<string, InviteCacheData>()
            newInvites.forEach(invite => {
                updatedUses.set(invite.code, {
                    uses: invite.uses ?? 0,
                    inviterTag: invite.inviter?.tag ?? null,
                    inviterId: invite.inviterId
                })
            })
            invitesCache.set(member.guild.id, updatedUses)

            if (usedInviteCode) {
                console.log(`${member.user.tag} joined using invite ${usedInviteCode} from ${inviterTag ?? 'Unknown'}`)

                if (inviterTag && inviterId) {
                    let roleid = await discord_client.sqlite.getRoleFromUser(inviterTag)

                    if (!roleid) {
                        const role = await member.guild.roles.create({
                            mentionable: false,
                            name: inviterTag,
                            reason: `cascade role for ${inviterId}`
                        })

                        roleid = role.id
                    }

                    if (roleid) {
                        member.roles.add(roleid)
                    }
                }
            } else {
                console.log(`Could not determine which invite was used by ${member.user.tag}`)
            }
        } catch (err) {
            console.error('Error determining invite used:', err)
        }
    })

    discord_client.login(process.env.TOKEN)
}

main()