import {BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {Plane} from "./Plane";
import {DiscordWebhook} from "./DiscordWebhook";

@Entity()
export class DiscordAssignment extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "integer"})
    plane_id!: number;
    @Column({type: "integer"})
    discord_account_id!: number;
    @ManyToOne(() => DiscordWebhook, discord => discord.assignments, {eager: true})
    @JoinColumn({name: "discord_account_id"})
    discordAccount!: DiscordWebhook;
    @ManyToOne(() => Plane, plane => plane.discordAccountAssignments)
    @JoinColumn({name: "plane_id"})
    plane!: Plane;
}
